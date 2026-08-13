# Sparta FIN AP — Project Reference

**File:** `Sparta ap stock tracker.html` — single self-contained HTML file (~260KB, ~4800 lines). No build step, no dependencies, no server. Opens directly in a browser or via any static host (Netlify, GitHub Pages, `file://`).

Current build stamp: `build 2026-07-26p` (footer, bottom of page). **Bump the letter suffix on every change** (`...26p` → `...26q`). If the day changes, bump the date and reset to `a`.

This doc exists to onboard a new coding session (e.g. Claude Code) quickly. Read this before touching the file.

---

## 1. Architecture

One `<html>` file, three parts in order:
1. `<style>` — all CSS, including per-tab theme overrides (see §5)
2. Markup — header, tab bar, five view `<div>`s (`dashView`, `contribView`, `yearlyView`, `monthlyView`, `archiveView`), modals, PIN gate
3. `<script>` — two script blocks:
   - **First block**: the editable `FIREBASE SETUP` config (see §4) — kept separate and clearly marked so a user can edit just this without touching logic
   - **Second block**: all application JS (state, render functions, event wiring)

No frameworks. No build tooling. Vanilla JS, template literals for HTML generation, direct DOM manipulation (`$('id')` helper = `document.getElementById`).

### Editing workflow used throughout this project
Edits are made via Python scripts that do targeted `str.replace()` on the HTML source, then:
1. `node --check` on the extracted `<script>` block to catch syntax errors
2. Targeted `grep -c` to confirm a replacement actually landed (silent no-op replacements are the #1 recurring bug — see §8)
3. Functional verification only when explicitly requested (see §9 — testing policy has changed)

---

## 2. State & Data Model

### The `state` object (defined ~line 2281)
```js
let state = {
  holdings, cash, history,              // Dashboard
  ccy, fx,                              // display currency + live USD→CAD rate
  contribs, limits, limitsY, yearly,    // Contributions
  cYear, logYear,                       // Contributions: viewed year / log filter
  fbOn, apiKey, updatedAt, bootStamp,   // sync + live prices + sync bookkeeping
  filter, range                         // Dashboard: account filter / chart range
};
state.yf = {...}      // Yearly Finance — see below (set ~line 3724, separately from the block above)
state.me = {...}      // Monthly Expense — see below (set ~line 4125)
```

### Four independent data domains — **currency rules differ by domain**
| Domain | Storage keys (localStorage) | Currency |
|---|---|---|
| **Dashboard** | `sparta.dash.holdings`, `sparta.dash.cash`, `sparta.dash.history` | Native per-holding (`h.ccy`), converts to CAD/USD on display via `state.fx` |
| **Contributions** | `sparta.contrib.entries`, `sparta.contrib.limitsY`, `sparta.contrib.yearly` | **CAD only** — no conversion, ever |
| **Yearly Finance** | `sparta.yf.data` → `{txns, planned, start, cats}` | **CAD only** |
| **Monthly Expense** | `sparta.me` → `{rules, imported, chartCats}` | **CAD only** — reads/writes the **same** `state.yf.txns` array as Yearly Finance (no separate expense store) |
| **Archives** | *(none yet — placeholder)* | Should be **CAD only** if it touches money, consistent with Yearly/Monthly/Contributions |

**Rule, stated explicitly because it was violated and fixed twice in this project:** Dashboard is the only tab that converts currency. Contributions, Yearly Finance, Monthly Expense, and (going forward) Archives must store and display amounts exactly as entered, in CAD, with zero multiplication by `state.fx`. A past bug stored Contributions in USD base and re-converted on every render, causing values to visibly drift whenever the exchange rate moved. Do not reintroduce this pattern.

### Full localStorage key inventory
```
sparta.ccy  sparta.fx  sparta.key  sparta.limits  sparta.fbOn  sparta.updatedAt  sparta.tabOrder
sparta.dash.holdings  sparta.dash.cash  sparta.dash.history
sparta.contrib.entries  sparta.contrib.limitsY  sparta.contrib.yearly  sparta.contrib.cadFixed
sparta.yf.data  sparta.me
sparta.pinOn  sparta.pinCode  (sparta.pinHash — legacy, cleared on read, do not reuse)
```

### Yearly Finance data shape
```js
state.yf = {
  txns: [{id, type:'income'|'expense', date:'YYYY-MM-DD', amt, desc, cat}],
  planned: { '2026': {CategoryName: amount, ...} },   // per-year planned amounts
  start: { '2026': amount },                          // per-year opening balance (set in Settings)
  cats: { exp: [...15 default categories], inc: [...6 default categories] }   // user-editable
}
```
`normalizeYF()` (called on load and before every save-critical function) guarantees this shape exists even if a Firebase pull delivers a partial/corrupt object — **do not remove this guard**, it fixed a real crash (see §8).

### Monthly Expense data shape
```js
state.me = {
  rules: { 'merchant key': 'Category' },   // learned from user corrections, keyed by first 3 words of description
  imported: [ 'fingerprint', ... ],        // dedup fingerprints from CSV imports, capped at 5000
  chartCats: ['Groceries','Entertainment','Health/medical','General']   // default trend-chart selection
}
```
Monthly Expense is a **view**, not a separate ledger — it reads/writes `state.yf.txns` filtered to `type:'expense'`. Category CRUD (add/rename/delete) in Yearly Finance and category selection in Monthly Expense operate on the same `state.yf.cats.exp` array.

### `normalizeYF()` / `normalizeME()`
Both are idempotent shape-repair functions. Call them defensively at the top of any new function that reads `state.yf`/`state.me` before the data is guaranteed initialized (e.g. right after a Firebase pull, or in any new Archives function that touches historical transactions).

---

## 3. Tab Navigation

Five tabs: `dash`, `contrib`, `yearly`, `monthly`, `archive`.

```js
const TAB_DEFAULT = ['dash','contrib','yearly','monthly','archive'];
```

- **`applyView(view)`** (~line 2897) is the single router. It shows exactly one view container, toggles body theme classes (`dash-view`, `contrib-view`, `yearly-view`, `monthly-view`, `archive-view`), locks the currency/account selectors on every tab except Dashboard, forces CAD on Contributions, and calls `render()`.
- **Tab order is user-configurable** (Settings → drag chips or ▲▼). `tabOrder()` reads `sparta.tabOrder` from storage, falls back to `TAB_DEFAULT`, and self-heals if a tab is added/removed from the default list later. `applyTabOrder()` physically reorders the DOM buttons via `appendChild`.
- **The app opens on whichever tab is first in the configured order** — `applyView(tabOrder()[0]||'dash')` runs at boot. It does **not** remember the last-viewed tab across reloads (that was removed deliberately per user request).
- Each of Yearly Finance and Monthly Expense has its own year/month selector in the tab bar (`yfYearWrap`, `meMonthWrap`), shown only while that tab is active.

**If adding Archives functionality that needs a year/month selector, follow this same pattern**: a `<div class="yearbar" id="archiveXxxWrap">` toggled via `applyView`, not a new top-level nav element.

---

## 4. Firebase Sync — read this before touching anything sync-related

This has been the single most bug-prone area of the project. The current design, as of build 26n–26p, is the result of three rounds of real bugs found via multi-browser simulation. **Do not revert to timestamp-only comparison.**

### Config lives in the file, not in Settings
Near the top of the second `<script>` block, clearly marked:
```js
const FIREBASE_ENABLED = false;
const FIREBASE_CONFIG = { apiKey, authDomain, databaseURL, projectId, ... };
const SYNC_KEY = "";
const FINNHUB_KEY = "";   // optional, for live stock prices
```
Settings only exposes: on/off toggle, Test connection, Push, Pull, "How do I set this up?", "What is stored?". No credential input fields exist in the UI — this is intentional, per explicit user instruction.

### Cloud shape
```
sparta/<SYNC_KEY>/core                     → { holdings, cash, contribs, yearly finance, pin, updatedAt, ... }
sparta/<SYNC_KEY>/history/<YYYY-MM-DD>/<ts> → [ALL, TFSA, FHSA, Other]   (compact array, one node per day)
```
Per-day history writes replaced full-blob writes specifically to cut Firebase bandwidth (~99.7% reduction, measured). **Never go back to re-uploading the entire history array on every snapshot.**

### The connect/merge algorithm (`fbConnect`, ~line 2733)
On load, before any startup code runs:
- `BOOT_HAD_LOCAL_DATA` — computed by inspecting raw localStorage directly, **before** any migration/normalize function can fabricate a timestamp
- `bootStamp` — `state.updatedAt` frozen at the exact moment of load

Decision table:
| Cloud has data | This browser has data | Action |
|---|---|---|
| Yes | No | **Pull only. Never push.** |
| Yes | Yes, cloud ≥ local | Pull |
| Yes | Yes, local > cloud | Push |
| No | Yes | Push (seed empty cloud) |
| No | No | Do nothing |

### Read-only until a real edit happens
```js
let fbUserEdited = false;
var fbBooting = true;   // var, not let — read across the whole app before its own declaration executes
```
`persist()` only calls `markUserEdit()` (which unlocks writes) if `!fbBooting && !fbApplying`. `fbBooting` flips to `false` only after the initial connect attempt resolves (or after an 8s failsafe timeout). **This means page loads, price refreshes, and startup migrations can never write to Firebase — only genuine user actions can.** This was the fix for a critical bug where opening the app in a fresh/incognito browser would silently overwrite real cloud data with an empty local state.

### Known limitation, by design
**No live listener.** Firebase is read once on connect, not watched continuously. Two devices open simultaneously will not see each other's changes until reload. Last-writer-wins, no merge. This was an explicit trade-off (user confirmed they don't need real-time multi-device sync) — do not add a live listener without discussing bandwidth/conflict implications first.

### SDK loading — do not reintroduce a race
`loadFirebaseSDK()` loads `firebase-app-compat.js` then `firebase-database-compat.js` **strictly sequentially** (second script's creation is chained off the first's real `onload`, not a fixed timer). An earlier version used a hardcoded 150ms delay between the two script loads, which silently failed on slower connections since the second script could execute before `firebase` existed as a global. Fixed with a proper `Promise` chain + a 12s timeout.

---

## 5. Visual Themes (per tab, deliberately distinct)

| Tab | Theme | Notes |
|---|---|---|
| Dashboard | Glassmorphism, aurora backdrop | Original design |
| Contributions | Glassmorphism | Teal/violet |
| Yearly Finance | Glassmorphism, deeper blur | `#yearlyView .panel` — 24px blur |
| Monthly Expense | iOS-style ultra-transparent glass | `#monthlyView .skeu-panel` (class name is legacy from an earlier skeuomorphic design, now glass — 40px blur, radial highlights, refracted rim) |
| Archives | **Minimal, flat, indigo `#8B93F8` accent** | No blur, no shadow, 1px hairlines. **This is the theme to extend when building Archives out** — do not add glassmorphism here, it was deliberately made distinct |

Each tab (except Archives, currently) has an animated SVG background field (`.tickerfield`, `.cashfield`, `.financefield`, `.monthlyfield`, `.archivefield`) toggled via body class, opacity-faded in/out over 0.7s. Icons drift slowly (`tkdrift` keyframe, 30–38s cycles). If Archives gets real content, consider adding a matching `.archivefield` icon set (vault, ledger, filing cabinet motifs already partially exist — check `#archiveField` in markup).

Color tokens used across Yearly/Monthly for financial meaning (reuse these, don't invent new ones):
- Income / Start: `--yf-inc` teal-ish, blue
- Expense / End: `--yf-exp` orange
- Invested: `#4ADE80` · Moved else: `#E55959` · Saved total: `#06B6D4` · Off paper: `#D98D4C`

---

## 6. Category System (Yearly Finance / Monthly Expense)

Fully user-editable, shared between both tabs since they share `state.yf.cats` and `state.yf.txns`:
- **Add**: validated (non-empty, ≤30 chars, case-insensitive dedup)
- **Rename**: propagates to every transaction using the old name, across all years, and to `planned` amounts
- **Delete**: blocked if any transaction (in any year) uses the category — must show $0 usage first

Default expense categories (`YF_EXP`, 15): Food, Credit Bill, Health/medical, Home, Transportation, Personal, Grocery, Misc, Travel, Debt, Other, Education\Tuition, Custom category 2, Investment, Other Bank.
Default income categories (`YF_INC`, 6): Gift/Stocks, Paycheck, Bonus, Temp, US/CA Support, Other.

Monthly Expense's CSV importer has its **own** 12-category list (`ME_CATS`) used only as the categorization target — Groceries, Household supplies, Health/medical, General, TV/Phone/Internet, Dining Out, Taxi, Entertainment, Other, Rent, Maintenance, Travel — with a keyword waterfall (`ME_KEYWORDS`) and an exclusion list for card payments/transfers (`ME_EXCLUDE`) so statement payments don't get double-counted as expenses.

---

## 7. PIN Lock

Full-screen gate (`#pinGate`), shown only if `sparta.pinOn === 'true'` and `sparta.pinCode` exists (checked synchronously in a tiny inline script right after `<body>`, before the main app script runs — this prevents any flash of unlocked content).

- **Stored as a plain 6-digit code**, not hashed. This was a deliberate reversal from an earlier SHA-256 hash design — the user wants to be able to read/reset the PIN directly in the Firebase console (`core.pin.code`) since there's no "forgot PIN" recovery flow in the UI anymore (removed on request).
- PIN travels in `corePayload()` under `pin: {on, code}` and applies on any cloud pull.
- It's explicitly a **privacy screen, not encryption** — documented as such in Settings copy. Don't oversell it as security in any new UI copy.
- Three animation phases cycle on the lock screen (rain → grow → store money, 10.5s loop) using the same color tokens as the Yearly Finance stat cards.

---

## 8. Recurring Bug Classes — check for these before shipping any change

These have each caused real, shipped bugs in this project. When making changes, actively guard against them:

1. **Silent `str.replace()` no-ops.** A string-match edit that doesn't find its target fails silently and leaves stale code + a handler bound to a nonexistent element — which then **aborts the entire init script**, taking down unrelated features. Always `grep -c` to confirm a replacement landed before moving on.
2. **Temporal Dead Zone crashes.** A `let`/`const` referenced before its own declaration line executes (common when one part of init calls a function defined later in the same script) throws and kills everything after it. Several critical flags (`fbBooting`, `legacyFbFound`) are declared with `var` specifically so they're hoisted and safe to reference early. Follow this pattern for new cross-cutting flags.
3. **Partial-object crashes after a cloud pull.** `store.get(key, default)` only applies the default when the key is *entirely absent* — a partial object from a wiped/edited Firebase record bypasses the default and crashes downstream code expecting a full shape. This is why `normalizeYF()`/`normalizeME()` exist and are called defensively in multiple places, not just once at boot.
4. **Currency conversion creeping into CAD-only tabs.** Grep for `state.fx`, `toBase(`, `rate()` in any new Contributions/Yearly/Monthly/Archives code — none of these tabs should reference them.

---

## 9. Testing Policy (current instruction — supersedes earlier turns in this project)

**Do not run full test suites, Playwright visual sweeps, or mobile audits unless explicitly asked.** Earlier in this project, every change was followed by extensive automated regression testing; the user has since asked to stop this by default.

- Only write a small, targeted unit test if verifying a specific piece of new logic is genuinely useful (e.g. a pure function's output, a calculation).
- Do not proactively run cross-tab regression, multi-viewport screenshots, or simulated year-rollover tests unless the user asks for them.
- Still use `node --check` for basic syntax validation — that's not "testing," it's confirming the edit didn't break parsing.

---

## 10. Known Gaps / Next Steps (as of this handoff)

- **Archives tab is an empty placeholder.** This is the primary target for new work. It currently renders one `<section class="panel cash">` with a note saying "tell me what you'd like archived." No data model, no functions exist for it yet.
- Plausible Archives scope, based on prior conversation: read-only view of closed positions, prior-year Yearly Finance summaries (the year selector was removed from Yearly Finance's main view when it became a static current-year badge — Archives could be where historical years live), or compacted history snapshots.
- No live Firebase listener (§4) — acceptable per user, don't add without asking.
- No xlsx import support (CSV only, by design — avoids bundling SheetJS in a single-file app).
