# Sparta FIN AP — Project Reference

**File:** `Sparta ap stock tracker.html` — single self-contained HTML file (~260KB, ~4800 lines). No build step, no dependencies, no server. Opens directly in a browser or via any static host (Netlify, GitHub Pages, `file://`).

Current build stamp: `build 2026-09-10F` (footer, bottom of page). **Bump the letter suffix on every change** (`...14c` → `...14d`). If the day changes, bump the date and reset to `a`.

> An optimisation + dead-code pass was applied on 2026-08-14 (load time −57%, running animations −58%). See `OPTIMIZATION-NOTES.md` for what changed and why, and `tests/` for the 87-check suite that verifies it.

This doc exists to onboard a new coding session (e.g. Claude Code) quickly. Read this before touching the file.

---

## 0. What the two money tabs are FOR

Get this wrong and the rest of the design goes wrong with it.

**Yearly Finance — the overall view.** The basics, big amounts only: Rent, Credit Bill,
Income. The question it answers is *where did the money go this year, and how much did
I save?*

**Monthly Expense — deep tracking.** Where the money actually goes week to week: am I
spending too much on Dining Out, on Entertainment? The question it answers is *what are
my habits?*

**They are separate components that happen to share one transaction ledger
(`state.yf.txns`).** Sharing the ledger is deliberate — a Monthly expense is genuinely
part of the year, and it is what makes bills/allocations work. Sharing the CATEGORY
LISTS is not:

- Yearly's list is `state.yf.cats.exp`, editable by the user on the Yearly tab.
- Monthly's list is `ME_CATS`, a fixed constant in the file.
- **Neither ever writes into or reads from the other.** A name can appear on both and it
  is still two different categories: Yearly's Rent is Yearly's, Monthly's is Monthly's.
- Do not "helpfully" auto-populate one from the other. That was the original behaviour
  and it leaked Yearly's Food / Rent / Credit Bill onto the Monthly picker.

### How the shared ledger is kept apart

Every expense row carries **`t.tab`** — `'yf'` if it was typed on Yearly, `'me'` if it was
typed or imported on Monthly (every allocation is `'me'`). Ownership is **stored, not
inferred**, because a name cannot decide it: both tabs may legitimately have a "Rent".

| | Yearly shows | Monthly shows |
|---|---|---|
| `tab:'yf'` (a bill) | yes — one row, its full amount | in the **list** only, so it can be itemised — never in the bar graph or the trend |
| `tab:'me'` | **never**, in any form | yes — list, bars and trend |

So a $1,500 credit-card bill is one $1,500 row on Yearly however finely Monthly broke it
down. Itemising never shrinks a bill and never makes it negative.

What Monthly has done is reported on the bill's own line in **TRANSACTIONS** as
**two separate facts**, each sitting beside the money it explains — never in the EXPENSES
table, which stays numbers only like every other row:

| Column | Note | What it is |
|---|---|---|
| **Amount** | `$2,240 Spend` | everything filed against this bill **except** the payments. Refunds are ordinary negative rows and count into it, so it can come out below zero and is printed signed |
| **Description** | `$1,449 Bill Paid` | the Bill Payment rows filed against this bill, flipped positive to read |

Each appears only when it has something to report: no rows of that kind, no line. A bill
nothing has been filed against carries neither.

There used to be a third figure, **`Itemised`**, which was the two netted together. It is
gone. Netting only reconciles if you also hold the *previous* month's bill in your head —
August's $750 balance is $1,250 of charges less the $500 that cleared July — and a single
number that needs another statement to justify it is worse than two numbers that need
nothing. It also carried a bug of its own: it bailed out when the net came to zero or
less, so the bills least accounted for were the ones that said nothing at all.

The arithmetic still holds, it is just not printed: `Spend − Bill Paid` is the balance on
the PDF. The over-allotment warning on import is the one place that still uses the net,
because "more has been filed here than this bill can explain" is exactly that comparison.

A bill reports **only the lines pointing at its own `id`** (see `allot` in §2), and
allocations are filed by `allotM`, so a December purchase counts toward January's bill.

The only thing that crosses over is **"Allot to"**, which reads Yearly's bills for the
month — **one option per bill row**, labelled by its description (`Credit Amex — $1,000`),
not one merged option per category. Nothing else crosses.

### Bill Payment — how a card statement reconciles

July's bill is $500, August's is $750. August's statement lists $1,250 of purchases **and
the $500 that cleared July**, because that payment appeared on the August cycle. The user
types $750 off the PDF, and the arithmetic has to agree with that.

It does, and both halves of it stay on screen rather than being collapsed into one:

```
$1,250  Spend        every charge allotted to August's bill, under its own Monthly category
 -$500  Bill Paid    the July balance that cleared, category "Bill Payment"
 ------
  $750               = the balance on the PDF, which is what the user typed in
```

**Bill Payment is not spending.** It is a balance being cleared, so it is left out of the
top bar graph, the 12-month trend, Category by month, the table's category filter and the
month total. The one place it appears is **This Month's list**, where every payment against
one bill draws as a **single line pinned directly under that bill**: "Previous Month Bill
×2", dated the earliest of them, summed, attributed to whoever the *bill* belongs to. The
rows behind it are untouched — re-importing the same statement still recognises each one —
and the `⌄` toggle opens them for editing.

Rules that hold everywhere:

* the amount is **forced negative**, however the statement states it (some cards file a
  payment as a credit, some as a positive line);
* a payment must name a bill — refused on Add Expense without one, because a negative row
  in no total at all is worse than no row;
* `Bill Payment` sits **last** on every category picker, after the A–Z spending ones;
* only **card**-payment wordings route here (`payment thank you`, `autopay`, `pre-auth
  payment`, `online payment`, `payment received`, `cc payment`, `bill payment`). **Bank
  transfers** (`transfer to`, `transfer from`, `e-transfer`) are still dropped on import —
  importing one double-counts money already on the statement as the charge it paid for.

Caveat worth knowing: the merged line always reads "Previous Month Bill", which is the
common case but not always literally true (a mid-cycle payment, or one clearing an older
balance). Expanding the line shows each row's real description.

On Add Expense a Monthly category and an "Allot to" may be set **together** — what the
charge was, and what paid for it, the same pair an import writes. What may never be set
together is a **Yearly** category and an "Allot to": the bill already *is* a Yearly
category, so the row would be filed against Yearly twice. Only reachable while editing a
row saved under a Yearly name, and refused on save.

A Yearly bill listed on Monthly is **read-only there** — a YEARLY marker replaces the edit
and delete buttons. It is on that tab to be itemised against, not edited. Deleting a bill
on Yearly **detaches** whatever Monthly itemised into it, turning those rows back into
ordinary Monthly expenses; orphaning them would leave their money in no total at all.

Consequence, and it is deliberate: Yearly's total counts Yearly's rows only. Spending
typed straight onto Monthly is not in it. Yearly is the coarse view — big things — and
the credit-card bill is how card spending reaches it.

---

## 1. Architecture

One `<html>` file, three parts in order:
1. `<style>` — all CSS, including per-tab theme overrides (see §5)
2. Markup — header, tab bar, six view `<div>`s (`dashView`, `contribView`, `yearlyView`, `monthlyView`, `archiveView`, `planView`), modals, PIN gate
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
  cYear, logYear, cWho,                 // Contributions: viewed year / log filter / contributor filter ('ALL'|'Abi'|'Poo')
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

### Contributor tracking (Abi / Poo)
Every `state.contribs` entry carries a `who: 'Abi'|'Poo'` field, hardcoded (not Settings-configurable) directly in the `<select>` markup — no `CONTRIBUTORS` constant, matching every other short account-style select in this file. `contributedBy(acct,y,who)` sums by contributor; `contributed(acct,y)` (unchanged) still sums the household total and remains the only thing the TFSA/FHSA hero cards, room-remaining bars, and CRA-limit math ever read. `state.yearly` draft rows carry 4 amounts (`tfsaAbi`/`tfsaPoo`/`fhsaAbi`/`fhsaPoo`) instead of 2. A tab-local `state.cWho` ('ALL'|'Abi'|'Poo', session-only — not in `persist()`, same as `state.filter`/`state.range`) drives an "All/Abi/Poo" `.seg` filter at the top of the Contributions tab; it scopes **only** the deposit log and the contribution chart (which stacks Abi-bottom/Poo-top per account) — never the hero cards, room bars, or the yearly backfill table, since CRA room is a single pooled per-year figure, not a per-person split. All deposits logged before this feature existed migrated to `who:'Abi'` (a non-destructive, idempotent default-fill at the same two sites as the existing id/year migration — no flag needed, unlike the flag-guarded `migrateContribCAD`).

The same `who` field extends to `state.yf.txns` (income **and** expense), which Yearly Finance and Monthly Expense both read/write — one migration site instead of two, since `normalizeYF()` is already called defensively at the top of every render/save path on both tabs (`renderYF`, `renderME`, `yfSaveTx`, `meSaveTx`, `meApplyImport`, and after every Firebase pull via the `applyPayload()`→render cascade), so `y.txns.forEach(t=>{ if(!t.who) t.who='Abi'; })` inside it alone is sufficient. Each tab keeps its **own** session-only filter (`yfWhoFilter` on Yearly Finance, `meWhoFilter` on Monthly Expense — bare top-level `let`s, not on `state`, matching `yfFilter`/`yfChartMode`/`yfTxMonth`) rather than sharing one, mirroring how `yfYear` and `meMonth` are already independent per-tab view state despite sharing `state.yf.txns`. Scope, deliberately narrow like Contributions: Yearly Finance's filter touches only `#yfTxBody` — category planned/actual tables, the summary cards, and the monthly income/expense chart stay combined (budgets aren't per-person). Monthly Expense's filter is applied inside `meTxns()` itself, so it correctly scopes everything that has no budget/cap to protect — Total Spent, count, average, top category, the category bars, and the transaction table — plus the "vs previous month" comparison (which bypasses `meTxns()` and needed its own copy of the filter clause). The 12-month trend chart and category-by-month matrix stay unfiltered on both tabs. CSV-imported expenses default to `who:'Abi'` (no per-batch contributor picker); reassign via the normal edit flow.

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
  txns: [{
    id, type:'income'|'expense', date:'YYYY-MM-DD', amt, desc, cat, who:'ABI'|'POO',
    tab:'yf'|'me',   // WHICH TAB OWNS THE ROW — see §0. Never guess this from the
                     // category name; both tabs may have a "Rent".
    allot,           // optional: the ID of the Yearly expense row this line is
                     // itemised into. NOT its category name -- a month can hold two
                     // bills under one name (a $1,000 Amex and a $500 PC card, both
                     // "Credit Bill"), and a name made them one shared pool, so each
                     // reported the pair's combined figure against its own amount.
                     // Resolve it with yfBillOf(t) / yfBillById(id); yfKidsOf(id) is
                     // every line filed against one bill.
    allotM,          // 'YYYY-MM' — the bill month it is filed under, which may sit
                     // in a different year than `date` (a December statement line
                     // on January's bill)
    mOnly,           // true for a month-only entry typed on Add Expense (no day picked)
    src              // optional: the statement source typed at import time
  }],
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
  chartCats: ['Groceries','Indoor Entertainment','Health/medical','General']  // default trend selection
}
```
Monthly Expense shares the **ledger** (`state.yf.txns`) but not the **category list**.
It has its own fixed `ME_CATS` constant; Yearly's `state.yf.cats.exp` is a separate,
user-editable list. Neither is ever written to from the other side. See §0 and §6.

### `normalizeYF()` / `normalizeME()`
Both are idempotent shape-repair functions. Call them defensively at the top of any new function that reads `state.yf`/`state.me` before the data is guaranteed initialized (e.g. right after a Firebase pull, or in any new Archives function that touches historical transactions).

---

## 3. Tab Navigation

Six tabs: `dash`, `contrib`, `yearly`, `monthly`, `archive`, `plan`.

```js
const TAB_DEFAULT = ['dash','contrib','yearly','monthly','archive','plan'];
```

- **`applyView(view)`** (~line 2897) is the single router. It shows exactly one view container, toggles body theme classes (`dash-view`, `contrib-view`, `yearly-view`, `monthly-view`, `archive-view`, `plan-view`), locks the currency/account selectors on every tab except Dashboard, forces CAD on Contributions, and calls `render()`.
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
| Plan | Teal glass over `#071520` | `.plan-skin`, with a `.planfield` backdrop of drifting wave bands and planning motifs |

Each tab has an animated SVG background field (`.tickerfield`, `.cashfield`, `.financefield`, `.monthlyfield`, `.archivefield`, `.planfield`) toggled via body class, opacity-faded in/out over 0.7s. Yearly, Monthly and Archives also carry a fluid wave layer (`.wv-yf`, `.wv-me`, `.wv-arc`); Yearly's is stretched `scale(1,1.27)` ahead of its rotate so it reaches ~70% down the viewport without moving sideways. **Fading a field out is not enough — each also needs `animation-play-state:paused` when hidden** (bug class 8). Icons drift slowly (`tkdrift` keyframe, 30–38s cycles). If Archives gets real content, consider adding a matching `.archivefield` icon set (vault, ledger, filing cabinet motifs already partially exist — check `#archiveField` in markup).

Color tokens used across Yearly/Monthly for financial meaning (reuse these, don't invent new ones):
- Income / Start: `--yf-inc` teal-ish, blue
- Expense / End: `--yf-exp` orange
- Invested: `#4ADE80` · Moved else: `#E55959` · Saved total: `#06B6D4` · Off paper: `#D98D4C`

---

## 6. Category System — two separate lists

**They are not shared.** A name may exist on both tabs and it is still two different
categories. See §0 for why, and guard it: anything keyed on the category *name* alone
will do the wrong thing the moment both tabs have a "Rent".

### Yearly Finance — `state.yf.cats`, user-editable
- **Add**: validated (non-empty, ≤30 chars, case-insensitive dedup)
- **Rename**: rewrites `cat` on every **Yearly** transaction using the old name, across
  all years, and the `planned` amounts. It has **nothing to repoint** — `allot` holds the
  bill row's `id`, so renaming the category it sits under cannot break the link. (When
  `allot` held the *name*, a rename orphaned every allocation: the bill lost its note and
  the money landed in no total.) Monthly rows sharing the name are untouched.
- **Delete**: blocked if a **Yearly** transaction uses it. A Monthly row of the same name
  does not block it and is left alone.
- **Deleting a bill row** (`yfDelete`) names how much Monthly itemised into it and
  **detaches** those rows, turning them back into ordinary Monthly expenses. Orphaning
  them would leave their money in no total anywhere.

Default expense categories (`YF_EXP`, 15): Food, Credit Bill, Health/medical, Home, Transportation, Personal, Grocery, Misc, Travel, Debt, Other, Education\Tuition, Custom category 2, Investment, Other Bank.
Default income categories (`YF_INC`, 6): Gift/Stocks, Paycheck, Bonus, Temp, US/CA Support, Other.

### Monthly Expense — `ME_CATS`, fixed

Monthly Expense has its **own** 13-category list (`ME_CATS`), A–Z and entirely separate from Yearly's — Dining Out, Fees/Subscription, General, Groceries, Health/medical, Household supplies, Indoor Entertainment, Other, Outdoor Entertainment, Shopping, Taxi/Rental, Transit, TV/Phone/Internet. It is the target for both the CSV categoriser and Add Expense. A keyword waterfall (`ME_KEYWORDS`) drives the categoriser.

A **fourteenth** category, `Bill Payment` (`ME_BILLPAY`), is offered on the pickers after
those thirteen but is deliberately **not** in `ME_CATS`: it is not spending. `ME_NONSPEND`
lists it and `meIsNonSpend(c)` is the single test every chart, the month total and the
category filter consult — scattering that check is how a non-spend category leaks onto a
graph. `meIsMonthlyCat(c)` asks the combined question ("is this Monthly's at all?").
See §0 for what it is for. `ME_PAYMENT` routes card-payment wordings into it on import;
`ME_EXCLUDE` still drops bank transfers outright.

The list is **fixed**: it is a constant in the file, not user-editable, and it is never written to from Yearly nor read from it. See §0 for why.

### Monthly Expense specifics

- **Import Statement** and **Add Expense** are full width, one under the other. Add
  Expense is `.me-addform`, two rows of three — *Amount / Description / Allot to*, then
  *Add expense / Contributor / Category* — which halves the height it used to take.
  The chip beside *Add to expenses* names the month being filed into.
- **An import will not commit without a bill.** "Allot all to" starts on none, which used
  to file a whole statement as loose expenses. `meImpGate()` now disables the button and
  shows an amber reminder naming which of the two things is missing: the month has no
  Yearly expense to itemise into, or it has one and none is chosen. `meApplyImport()`
  refuses as well, so the gate is not UI-only.
- **Statement source** is free text, stored as `row.src`, shown as a tag beside the
  `→ bill` tag. There is no sign override — auto-detect reads the convention off the file.
- **"Allot to"** offers only the Yearly expenses that exist for the month being filed into
  — **one option per bill row**, valued by its `id` and labelled `description — $amount`
  (`Credit Amex — $1,000`). They used to be merged by category, so two cards billed in July
  offered a single option and both rows then reported the pair's combined itemisation
  against their own amount. The manual form follows its own Month picker; the importer
  follows the tab's month. It is scoped to `tab!=='me'`, so a Monthly row can never be
  offered as something to itemise into. This is the **only** thing that crosses the tabs.
- **Pairing on Add Expense**: a Monthly category and a bill may be set **together** (what
  the charge was, and what paid for it — the same pair an import writes). A **Yearly**
  category together with a bill is refused; the bill already is a Yearly category, so the
  row would be filed against Yearly twice. At least one of the two is required.
- **The two graphs describe habits**, so they carry `tab==='me'` rows only — a Yearly bill
  appears in the list but on neither graph. The top bar labels are upper-cased and take the
  same `meColor()` the trend chart draws each line in.
- **Import dedup** (`state.me.imported`, fingerprints capped at 5000) is built from
  Monthly's rows only; including a Yearly bill let one swallow an identical CSV row.

### Migrations that run on load

Each is idempotent and safe to leave in place — they repair ledgers written by older builds.

| Where | What |
|---|---|
| `normalizeYF()` | backfills `who`, `allotM` from the row's date, drops the retired `derived` flag, and backfills `tab` by row shape |
| `normalizeYF()` — `allot` repoint | rewrites a name-keyed `allot` to the bill row's `id`. Where one month held two bills under the same name, **the larger takes them** (nothing records which was meant; re-point by editing the row). One naming a bill that no longer exists is **detached**, same as `yfDelete` does, rather than left in no total. Runs *after* the `tab` backfill, which still reads the old shape |
| `meTagImported()` | second stage of the `tab` backfill, using the import log, which only Monthly has loaded |
| `meRecoverImportCats()` | re-derives the category of imported rows a middle build saved without one, keyed on the import log so a deliberate uncategorised note is never swept up |

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

0. **A name used as an identity — now fixed, and worth keeping fixed.** `allot` used to
   store a Yearly *category name*. Rename, delete and the year boundary were three faces
   of that one weakness, each found separately; the fourth was the one that finally forced
   the rewrite — two bills under one name in one month became a single pool, and each
   reported the pair's combined itemisation against its own amount. `allot` now holds the
   bill row's **`id`**, resolved through `yfBillOf(t)` / `yfBillById(id)` / `yfKidsOf(id)`.
   **Do not reintroduce name matching** for anything that identifies a row. A category name
   is a label the user can change and can legitimately reuse; only `id` is identity.

1. **Silent `str.replace()` no-ops.** A string-match edit that doesn't find its target fails silently and leaves stale code + a handler bound to a nonexistent element — which then **aborts the entire init script**, taking down unrelated features. Always `grep -c` to confirm a replacement landed before moving on.
2. **Temporal Dead Zone crashes.** A `let`/`const` referenced before its own declaration line executes (common when one part of init calls a function defined later in the same script) throws and kills everything after it. Several critical flags (`fbBooting`, `legacyFbFound`) are declared with `var` specifically so they're hoisted and safe to reference early. Follow this pattern for new cross-cutting flags.
3. **Partial-object crashes after a cloud pull.** `store.get(key, default)` only applies the default when the key is *entirely absent* — a partial object from a wiped/edited Firebase record bypasses the default and crashes downstream code expecting a full shape. This is why `normalizeYF()`/`normalizeME()` exist and are called defensively in multiple places, not just once at boot.
4. **Currency conversion creeping into CAD-only tabs.** Grep for `state.fx`, `toBase(`, `rate()` in any new Contributions/Yearly/Monthly/Archives code — none of these tabs should reference them.
5. **`min-width:auto` on a grid or flex item.** An item's min-content can push a `1fr`
   column past its share, overflowing the container with nothing to scroll. It has bitten
   Dashboard, Plan and (at 320px only) the Yearly transaction form, where a date input's
   min-content pushed two columns to 248px inside a 243px box. Add `min-width:0` to grid
   children that hold inputs.
6. **Stacking contexts.** A parent with `position:relative;z-index:N` scopes its children's
   z-index. Hit three times — the Plan aurora, the trend-filter popover the chart painted
   over, and the Yearly panels. Fix with matching specificity, not a bigger number.
7. **A test selector that matches nothing passes.** The mobile sweep selected `main *`;
   there is no `<main>` in this file, so it silently passed on every tab at every width
   while proving nothing. Any sweep that iterates a collection should assert the
   collection is non-empty first — `test-mobile.js` §8 does.
8. **`opacity:0` does not stop an animation.** The per-tab backdrop fields need an explicit
   `animation-play-state:paused` when hidden, or every tab's animation runs at once.

---

## 9. Testing Policy

**Unit tests, not regression sweeps** — that is the standing instruction. In practice the
suite under `tests/` has become the only thing making a 6,400-line single file safe to
change, so it is kept green rather than skipped.

- `cd "Sparta Finance Tracker/tests" && ./run-all.sh` — thirteen suites, **811 checks**.
  Needs `node_modules` (Playwright); link it, run, then remove the link.
- Add a check when behaviour is pinned down, especially arithmetic. Every money rule in
  §0 has one, because each was re-litigated at least once.
- `node --check` on the extracted `<script>` blocks after every edit. That is not testing,
  it is confirming the file still parses.
- **Verify against the app, not against the tests written beside it.** Three audits in a
  row found bugs the suite was blind to, all in paths nobody had written a test for.

---

## 10. Known Gaps / Next Steps (as of this handoff)

- **Archives tab is an empty placeholder.** Still the primary target for new work: one
  `<section class="panel cash">` and a note. No data model, no functions. It does have a
  wave backdrop and motif set already.
- **Plan tab** exists and is built out (segments, dated items, running balance, lowest
  point) — see `tests/test-plan.js` for the behaviour it guarantees.
- Plausible Archives scope, based on prior conversation: read-only view of closed positions, prior-year Yearly Finance summaries (the year selector was removed from Yearly Finance's main view when it became a static current-year badge — Archives could be where historical years live), or compacted history snapshots.
- No live Firebase listener (§4) — acceptable per user, don't add without asking.
- No xlsx import support (CSV only, by design — avoids bundling SheetJS in a single-file app).
- `SpAPP.png` is not committed next to the HTML, so the header/PIN logo 404s until
  you drop it in this folder. The old `file:///C:/Users/...` fallback was removed
  (browsers block `file://` subresources on any http-served page).
