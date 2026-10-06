# Sparta FIN AP — Project Reference

**File:** `Sparta ap stock tracker.html` — single self-contained HTML file (~405KB, ~7050 lines). No build step, no dependencies, no server. Opens directly in a browser or via any static host (Netlify, GitHub Pages, `file://`).

Current build stamp: `build 2026-09-30B` (footer, bottom of page). **Bump the letter suffix on every change** (`...14c` → `...14d`). If the day changes, bump the date and reset to `a`.

> An optimisation + dead-code pass was applied on 2026-08-14 (load time −57%, running animations −58%). See `OPTIMIZATION-NOTES.md` for what changed and why. The suite in `tests/` has grown well past that pass — see §9 for the current count.

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

### The planned-vs-actual tables read differently on each side, on purpose

Column order is **Category, Spend/Earned, Planned, Diff** (plus **Monthly** on Expenses).
The money you actually moved comes first; the plan you are judging it against sits beside
it. "Actual" is called **Spend** on Expenses and **Earned** on Income.

**Diff is NOT the same formula on the two tables.**

| | Diff | The question it answers |
|---|---|---|
| Expenses | `Planned − Monthly` | am I off my monthly rate? |
| Income | `Planned − Earned` | am I off the year to date? |

That is deliberate and both are pinned in `test-yf-highlights` §8c, because one table
silently adopting the other's formula would look perfectly reasonable on screen.

**`Monthly` is `actual / nowM`**, where `nowM` is the months elapsed — the current month
number, or 12 for a year already past.

**Planned is entered as a MONTHLY figure** from 2026-09-30 onward. That is what makes
`Planned − Monthly` compare like with like.

**The overview bars above the tables annualise it** (`expPlanT*12`), because they sit
against the *year's* Spend and Earned. `paMax` is computed from the annualised figures too —
scaling the bars off the monthly sum while printing the annual one would leave them in the
wrong proportion, which is subtler than the bug it replaced. Those bars are labelled
**Spend** and **Earned** to match the tables. Before this, a monthly plan drew the plan bar
at ~8% of the track whatever the budget said, reading as a catastrophic overspend on every
category. Expect small rounding: 1,167 × 12 is 14,004, not 14,000.

**Still not handled:** **Income's Diff subtracts the year-to-date total**, so a monthly plan
against an annual figure reads hugely negative (a 3,300 plan against 41,800 earned shows
about −$38,500). Income needs the same monthly basis, which means giving it a Monthly
column. The bars are right; the table under them is not.

**Totals rows share the category rows' renderer.** They used to build their own Diff cell,
which is how the income total printed `$-7,200` the first time that number could go
negative — the `−$n` handling lived only in the row path. `diffCell()` now serves both.

**Do not read these columns by position in a test.** `test-bills.js` did (`children[2]`) and
reported a totals bug when the columns were reordered and it started parsing an `<input>`.
Find the column by its heading.

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
sparta.yf.data  sparta.me  sparta.plan  sparta.notes
sparta.localOff

Everything above except the DEVICE keys is filed under a database fingerprint:
  sparta.<DB_ID>.yf.data      e.g. sparta.9c72kx1.yf.data
Device keys (bare, never namespaced): localOff, pinOn, pinCode, pinHash,
  tabOrder, ccy, fx, key, fbOn, fbConfig, fbSyncKey
sparta.pinOn  sparta.pinCode  (sparta.pinHash — legacy, cleared on read, do not reuse)
```

### One drawer per database — `DB_ID` / `nsKey()`

Every **per-database** key is filed under a short fingerprint of the Firebase config:

```
sparta.9c72kx1.yf.data      production
sparta.a3f1m0p.yf.data      dev
sparta.local.yf.data        no cloud configured
```

Switching the config in the file switches drawers. Nothing is compared, merged or
overwritten — the other drawer is simply not opened, and is intact if you switch back.

**Why this exists.** Testing against a dummy database left dummy rows in localStorage
stamped *just now*. Pointing the file at production and reloading in the same browser made
them look **newer** than the real data, so `fbConnect` pushed them over it. The timestamp
was never the problem: recency answers *"which is more recent"*, and the question that
mattered was *"does this copy belong to this database at all"*. The dummy data was not
stale — it was **foreign**.

- `dbFingerprint(projectId, databaseURL, syncKey)` — FNV-1a over the three values,
  normalised (trimmed, lowercased, trailing slash stripped) so a capital or a slash added
  months later cannot orphan a drawer.
- **`SYNC_KEY` must stay in the hash.** Three nodes inside one project share a `projectId`
  and a `databaseURL`; the key is the only thing telling Test from Dev from Prod.
- **Not cryptographic, deliberately.** It is a *name*, not a secret, and it must be
  computed synchronously before the first `store.get()` builds `state`. `crypto.subtle` is
  async and undefined outside a secure context — which includes double-clicking the file.
- `STORE_DEVICE` lists what stays unnamespaced: the PIN, tab order, currency, the Finnhub
  key, the sync switch and the Firebase config. Namespacing those would mean your PIN
  vanishing every time you changed environment.
- `nsKey()` is applied inside `store` only, so nothing else in the app knows a fingerprint
  exists.

**Adoption runs once per database.** Keys written before namespacing carry no fingerprint,
so their origin is unknowable; they are copied into the current drawer, and `DB_ADOPTED`
then makes `fbConnect` treat them as having **no claim** for that one connect — the cloud
wins if it holds anything, and they are pushed only when the cloud is empty. A wrong guess
costs a pull rather than the ledger.

### `store` has two backings

`store` (get/set/del) is the single choke point every other part of the app writes
through. Normally it is `localStorage`. With **keep-data-here switched off**
(`sparta.localOff`) it is an in-memory `Map` instead: the browser keeps nothing of its own,
the cloud is the only copy, and closing the tab forgets everything. That mode exists so a
browser used for trying things out cannot leave rows behind that later look, to the cloud
merge, exactly like real work.

`STORE_EXEMPT` names the keys that always reach the disk regardless — and it is exactly
two things, neither of which is data:

| Key | Why it is exempt |
|---|---|
| `sparta.localOff` | the switch itself. Held in the store it controls, it could not survive the reload it is a setting for |
| `sparta.pinOn`, `sparta.pinCode` | read by the inline script at the top of `<body>`, **before** the app script exists — that is the only reason there is no flash of unlocked content (§7). A credential, not a row |

**The switch is locked shut unless cloud sync is connected** (`localCanTurnOff()`). With no
cloud and no local storage, a reload starts blank and the work is gone — worse than
anything the switch prevents. Turning it on erases the `sparta.*` keys already on disk;
leaving them would make the switch a lie, and would resurrect a stale copy over the cloud
if it were ever switched back.

### Clearing data — `RESET_ROWS` / `spartaReset()`

Settings → **Clear data** is a checklist — **one tick per tab, in tab-bar order**, all six
on a single row — and only what is ticked is emptied. `RESET_ROWS` is the single table the
checkbox list, the handler and the tests all read.

Two consequences of keying it to tabs rather than stores:

- **The notepad has no tick.** It is a panel on Dashboard and Contributions, not a tab, so
  folding it into either would be arbitrary. `sparta.notes` therefore survives every
  combination and has to be cleared from the panel itself. `RESET_CLEAR` has no `notes`
  entry; add one alongside a tick if that changes.
- **Archives has a tick but no store.** `RESET_CLEAR.archive()` is a deliberate no-op so
  the list mirrors the tab bar and the id is reserved — when Archives gets data, that
  function is the only place that needs to learn about it.

Yearly Finance and Monthly Expense are **row filters, not keys** — they share one ledger
(`state.yf.txns`) and are told apart by `t.tab` (§0). Clearing Yearly alone leaves
Monthly's allocations pointing at bills that no longer exist; `normalizeYF()` already
detaches those, turning them back into ordinary Monthly expenses, so nothing lands in no
total at all.

Never touched by any tick, because they are credentials and preferences: `sparta.pinOn`,
`sparta.pinCode`, `sparta.fbConfig`, `sparta.fbSyncKey`, `sparta.fbOn`, `sparta.tabOrder`,
`sparta.ccy`, `sparta.fx`, `sparta.key`. `sparta.contrib.cadFixed` is also left set — it is
a migration marker, and clearing it would let a later cloud pull of already-CAD figures be
multiplied by the FX rate a second time.

**A clear defaults to this browser only.** Every persist path ends in
`cloudSaveDebounced()`, so without a guard a local clear would be pushed straight up and
take the cloud copy with it. `fbLocalOnly` suppresses that for the duration. It is
deliberately *not* `fbApplying` — that one means "we are applying cloud data", and
overloading it reads as a bug later. "Also clear the cloud" is a separate, explicitly
ticked box.

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

### Archives data shape — `state.archives`, `sparta.archives`

One record per sealed year, newest first. A record is a **snapshot**, not a view: it holds
the figures it was taken with, and the ledger moving underneath it must not change them.
That is the whole point of the tab, and it is the thing to protect when editing anything
here.

```js
{ id, year, sealedAt, sealed,                 // sealed === year < this year
  stats:{ start, end, invested, moved, saved, offPaper, growth },
  entries,                                    // how many Yearly rows the year held
  exp:[{c,v}], inc:[{c,v}],                   // category tables, biggest first
  mInc:[12], mExp:[12],                       // the month-by-month bars
  contrib:{ abiT, abiF, pooT, pooF },         // stored, NOT re-derived on render
  highlights:[{title,line,tone}],             // Yearly's cards, frozen
  byCat:{ cat:[12] } }                        // Monthly's category grid
```

**Everything is computed by the functions the live tabs use** — `yfTxns`, `yfActual`,
`yfCats`, `yfHighlights`, `meMonthlyByCat`, `contributedBy`. `arcSnapshot()` swaps
`state.yfYear` in a `try/finally` rather than re-implementing "which rows belong to this
year", because two copies of that filter is exactly how an archive ends up disagreeing with
the year it came from.

Three things that have already bitten here:

- **`meMonthlyByCat(year)` wants a STRING.** It compares `key.slice(0,4) !== year`, so a
  numeric year matches nothing and the category grid comes back silently empty.
- **`yfCats(type)` is the CONFIGURED list, not the categories in use.** A row can carry a
  name that was renamed or dropped from the list afterwards; building the tables from
  `yfCats()` alone leaves that money out and the table stops adding up to the End figure
  above it. `arcSnapshot` unions the configured names with the ones the year's rows
  actually carry.
- **The contributions line is built and stored, not derived on render.** Contributions keep
  being added after a year is sealed, and an archive that quietly changes is not an archive.

### The year rollover — how a year gets sealed

Sparta is a static file: its code runs only while a tab is open, so "archive it on
31 December" cannot mean a timer. It means **on every load, seal any past year the ledger
holds that has never been sealed** (`arcAutoSeal()`, run from the Archives boot block).
Opening the app on 2 January seals the year that just ended; opening it for the first time
in March still seals it, and sweeps up 2024 and 2025 besides. **+ Add year** is the manual
route and seals *this* year with one press, no prompt.

**Nothing is deleted, ever.** Yearly and Monthly are already scoped to `state.yfYear`,
which is read fresh from the clock at load, so 1 January shows an empty year without
touching a row — and the Yearly tab's year selector still walks back into last year. An
archive is a COPY, not a move.

Three guards, each of which has a test that fails without it:

- A record with `sealed:true` is **final** and is never re-taken.
- A record with `edited:true` — set the moment the pencil corrects a figure — is never
  re-taken either, sealed or not. Without this, a hand correction is silently wiped on the
  next load.
- Only an **unedited preview** of a year that has since ended is re-taken and upgraded to
  sealed, because a preview never claimed to be the last word.

`arcCarryStart()` then seeds the new year's opening balance from last year's closing one,
**only when this year has no figure of its own** — `now in state.yf.start`, not a falsy
test, so a deliberately typed `0` survives. It stays editable on the Yearly tab like any
other year's.

## Dashboard

### Closed positions (`state.sells`, `sparta.dash.sells`)

Sells used to be recorded **nowhere**: `confirmSell()` adjusted cash, dropped the holding,
showed the realised P/L in a toast and kept nothing. Everything sold before this shipped is
unrecoverable; the panel fills from the first sale after it.

```js
{ id, t,            // ms timestamp -- the date column
  sym, acct, qty,
  price, avg, ccy } // NATIVE price and average cost, plus the currency they are in
```

**Native figures only, never a converted total** — a record that bakes in today's exchange
rate is wrong tomorrow. Proceeds, cost and P/L are all derived at render time. The row is
written in `confirmSell()` **before** the holding is touched, because a full sale removes the
row and `h.avg` goes with it.

**The USD/CAD switch deliberately does not reach this panel.** A Wealthsimple account holds one
currency per holding: a `.TO` position settles in CAD and a US one in USD, so restating either
would invent a number that was never real. Rows use `fmtNat`; the tiles total **per currency**
and show two figures where both are present, never added together. A currency with no sales is
omitted rather than shown as a zero. Percentages are currency-free and always correct.
`natToBase()` and `fmt()` appear nowhere in `renderSells()`.

### Eye on Stocks

Split out of the shared notepad into `#eyePanel`, which is **Dashboard-only** — a watchlist
with live quotes says nothing on a TFSA/FHSA room tracker. The points stay shared and still
move between the two tabs with `applyView()`. `notes.stocks` was always a separate array from
`notes.points`, so nothing needed migrating, and `notes.text` (the old Strategy box) is left
in storage untouched — the field is gone, nothing deletes the value.

A row expands to three Finnhub calls (`/quote`, `/stock/profile2`, `/stock/metric`), **fetched
on expand and cached for the session**: the free tier is about 60 calls a minute and this is
three per stock, so fetching the list at boot would be rate-limited before the page finished
drawing. Figures are shown in the stock's own currency.

**`.TO` has no data on the free tier**, so for a Canadian holding the row shows the ticker, the
quote link and a sentence saying why. That is the *ordinary* result for this portfolio, not a
failure, and it has to read as deliberate. Note `quote.c === 0` is Finnhub saying it has no
such symbol, not a price of zero.

Expanding a stock is a **read**: it must never call `markUserEdit()` or `touchUpdatedAt()`, or a
tab left on the Dashboard would outrank a phone that was actually used — the data-loss path
closed in §4b/4c of `test-storage.js`.

### The broker mark

Two brokers, each holding a TFSA and an FHSA, so the account alone cannot say where a position
lives. `h.broker` is `''` (Wealthsimple, the default) or `'Q'` (QuestTrade), toggled by a button
to the left of the ticker. It is a **label**: it changes no total, no filter and no figure, and
adding a position under TFSA/FHSA is unaffected. Blank is not invisible — the box keeps its
width so tickers stay aligned whether or not a row is marked, and it is a real `<button>` so it
can be tabbed to. The grey is the `--text-dim` the "Other" account tag uses.

The optional **current price** field is gone from Add a position: a new holding starts at the
buy price with `manual:false` and is left to the live refresh, which is exactly what leaving
that field blank used to do.

### The four account cards

Four cards in a plain 2x2: TFSA, FHSA, Other and **POO's WS value**.

`Other` used to carry `grid-column:1/-1` and span the whole row, which made it read as a
different *kind* of thing rather than simply the third account. With a fourth card beside it the
span is gone and every account is the same shape. Other still hides itself when it holds nothing,
leaving three.

**`#pooCard` is a placeholder, deliberately.** Nothing writes to it, it is in no total, and the
account filter does not know about it — `state.cash` still has three keys. It reads zero, but
through `fmt()` like every other figure, so it follows the USD/CAD switch and shows `C$0.00`
beside the others rather than a bare `0`. Wiring it to real data is a separate piece of work;
until then the tests pin that it stays out of `state` and out of the hero total.

### Past sells: a window, not the whole ledger

A sell ledger only grows, so the panel shows **thirty days to today** by default, changed with
the two date boxes and the Search button. The range is a *view* preference and is deliberately
not stored: it costs nothing to set again, and persisting it would mean a sale could be missing
on the next load with no sign of why. A backwards range is swapped rather than showing nothing.

Two different empty states, because they mean different things: **nothing sold yet**, and
**nothing in these dates**. Showing the first to someone who has sold plenty would read as lost
data.

The Sells and Winners tiles were removed — a count of rows is readable from the rows.

**The columns are fixed proportions** (`table-layout:fixed` with a `<colgroup>`): 14 / 24 / 21 /
30 / 11, becoming 19 / 30 / — / 38 / 13 at ≤430px where the percentage column is hidden. Under
auto layout the **header** drove the widths — `% profit` was wider than any value beneath it, so
that column took 100px to show `+55.41%` and left a visible gap beside the ticker, and the
proportions moved about as the data changed. The header is `Profit` now; the values all carry a
`%`, so it was saying it twice.

Two things that had to be measured rather than reasoned about:

- **Hiding the percentage cells is not enough — the `<col>` has to go too.** With only the cells
  hidden the remaining cells map onto the wrong columns by position: the amount inherited
  `width:0` and the two buttons were handed 38%. `#sellTable .c-pc{display:none}` removes the
  slot.
- **1024px is the tightest case**, not the phone: still two columns, so the panel is at its
  narrowest, and a four-digit percentage beside a five-figure amount overflowed by 11px at the
  full type size. The figures step down there the same way they do at ≤430px.

**Fitting five columns into the narrow column.** Measured against the worst case it will really
meet: a four-digit quantity, a four-figure amount and a percentage. The date is day and month
over the year, so the column needs no more width than `04 Oct`; the account and quantity are
`white-space:nowrap`, since `FHSA · 8888` was wrapping under the ticker and costing a third row;
the headers are nowrap so `% profit` stays on one line; and the correct and undo buttons stack
rather than sitting side by side. At **≤430px the percentage column folds under the amount** —
five columns cannot hold a four-figure amount *and* a percentage at phone width (measured 328px
of table in 248px of panel at 320px), and putting the percentage under the figure is exactly
what the holdings table already does with its P/L. Result: zero sideways scroll from 1440 down
to 320px.

### A note wraps instead of disappearing

The notepad's rows were `<input>`, so a long point ran past the right edge and the rest was
simply invisible. They are `<textarea rows="1">` now, grown to their content by `npAutoSize()`.

Three things that needed care:

1. **scrollHeight counts padding but not the border**, while the height is border-box — setting
   one from the other leaves the box a border short and clips the last line's descenders. The
   difference is added back.
2. **A hidden element measures 0**, so a sizing pass that runs while the tab is off screen
   collapses every row to nothing. Hence the `offsetParent` guard and the second pass from
   `applyView()` when the tab comes back (bug class 14).
3. **Enter must still add the next point**, not a newline — a textarea would do the latter by
   default. `Shift+Enter` is left alone for anyone who does want a break.

`.np-row` aligns to `flex-start` so the bullet and the bin sit beside the first line rather than
floating in the middle of a grown row.

### Correcting a past sell

A wrong quantity or price used to be permanent, and it was wrong in **two** places: the
history line *and* the portfolio. `sellReverse(rec, q2, p2)` puts both right.

```
dq = rec.qty - q2            // > 0 shares come back, < 0 more leave
cash[acct] += natToBase(q2*p2 - rec.qty*rec.price, rec.ccy)
dq > 0 and the holding exists  ->  avg = (avg*qty + rec.avg*dq) / (qty+dq);  qty += dq
dq > 0 and it is gone          ->  re-create it at rec.avg, rec.ccy
dq < 0                         ->  qty += dq, average untouched, remove at zero
rec.qty = q2; rec.price = p2            // rec.avg is NEVER rewritten
```

**`rec.avg` is the cost basis of the shares that were sold**, and no correction touches it —
it is what the P/L is computed from, and those shares cost what they cost.

**It checks before it writes.** Selling more than is held is refused with the holding, the
cash *and* the record all untouched; a half-applied correction that had already moved the cash
would be worse than the original mistake.

**Delete is the same path with `q2 = 0`**, then the record is dropped: the sale is undone, not
merely forgotten.

Two limits, both deliberate:

- **Overdrawing is allowed.** Reversing a credit whose money has since been spent takes the
  balance negative, and the toast says so. Refusing would make a real correction impossible
  exactly when it is most needed.
- **Re-averaging is not perfectly reversible.** If shares were bought in between at another
  price, the returned shares blend in at `rec.avg` — correct going forward, but not the number
  that existed before the sale. That is average-cost accounting, not a bug. 300 at 133.3333
  plus 100 back at 100 gives exactly 400 at 125, and the test asserts that figure.

The dialog is `#sellModal` reused, with `sellMode` switching `sellHolding` / `updateSellPreview`
/ `confirmSell` between selling and correcting, plus one extra summary row the sell path hides.
`closeSell()` resets the mode — otherwise the next ordinary sale would run the correction branch.

### Three layout faults, and what caused each

- **A long watched name moved the whole page.** `.grid` was `1.6fr 1fr`; `1fr` means
  `minmax(auto,1fr)` and that auto floor is the content's **min-content** width, so one long
  company name in Eye on Stocks took the columns from 684/428 to **572/561**. The name was
  already ellipsised — an ellipsis caps the drawn text, not the floor the grid measures. Fixed
  with `minmax(0,1.6fr) minmax(0,1fr)`.
- **The ↗ dropped to its own line** in a narrow column (the first cell is 93px at 560px and
  73px at 390px). `.sym` is now `white-space:nowrap`, with the sub-line free to wrap; the table
  already sits in `.tscroll`, so a cell that needs room scrolls sideways like every other wide
  table here.
- **The broker mark pushed every ticker right**, because it was inline. It is now absolutely
  positioned in the first cell's 10px left padding, so the ticker sits exactly where it did
  before the mark existed and the mark lands flush with the "H" of *Holdings*.

Three things that mark had to get right, each found by measuring:

1. **Anchor it to the ticker, not the cell.** A table cell is vertically centred by default, so
   offsetting from the cell dropped the mark 9px below the ticker as soon as another cell in
   the row was taller. It hangs off `.sym` at `left:-10px`.
2. **Keep the padding at 10px on narrow screens.** The rest of the row tightens to 6px there;
   the gutter cannot, or the glyph is clipped.
   The mark also needs the **same 6px gap the quote arrow has** (`.qlink{margin-left:6px}`), so it
   sits at `left:-16px` — 10px of glyph plus that gap. `.tscroll` would clip the extra 6px, so the
   scroller is given `padding-left:6px` with a matching `margin-left:-6px`: it will now show 6px
   further left while the table does not move a pixel. Measured: the ticker stays 33px from the
   panel edge, and the gap reads 6px on both sides of it.
3. **Grow the hit area, not the box.** 10px wide is unhittable, and widening it would push the
   ticker back out, so a `::before` with negative insets gives ~14x39 at no layout cost.

### Each panel keeps its side

A panel belongs to a column and stays there, moving only up and down as its neighbours grow.

| left | right |
|---|---|
| Hero | Account stats |
| Holdings | Available balance |
| Eye on Stocks | Add a position |
| | Past sells |
| | Notes |
| | Import holdings |

**This replaced a version that placed panels by measured height**, putting each in whichever
column was shorter. That filled the page edge to edge but left a panel's column unfixed — Past
sells could sit left one day and right the next as the holdings list grew — and predictability
was judged worth more than density.

**The cost is known and accepted.** With Past sells on the right the right column runs about
**950px past the bottom of the left** at 1280px (left 1012, right 1964), so there is an empty
strip under Eye on Stocks. Moving Past sells — the largest panel at 491px — to the left would
close it to 30px; that was offered and declined. The strip is the trade, not a regression, and
the tests therefore do **not** check balance.

Because nothing depends on a panel's height any more, the `ResizeObserver` and the `resize`
listener the balancing needed are gone with it, along with the largest-first assignment and the
swap pass. What is left is two static lists and `place()`, which touches the DOM only where it
is already wrong — a no-op after the first call, which is what makes the panels feel nailed
down. There is no breakpoint branch: at ≤900px the grid collapses to one column and the lists
simply stack.

Two things still earn their keep. `applyView()` hands the notepad to `#contribView` and back, so
there is one real move left — hence the caret guard in `dashLayout()`, and the call from
`applyView()` that puts the notepad back between Past sells and Import holdings. Notes takes the
right column's width on Dashboard and is full width on Contributions, where `#contribView` is a
plain block.

### What crosses from Yearly and Monthly into an archive, and what does not

An archive is a **summary**, not a copy of the ledger, and the line between the two is easy
to move by accident. Pinned in `test-archives.js` §10 against a year where every answer is
hand-computable.

The asymmetry is the thing to understand. `yfTxns()` ends in `t.tab!=='me'`, so **everything
derived from it is Yearly-tab only** — `mInc`, `mExp`, `exp`, `inc`, `entries`, every figure
in `stats`, and the highlights. Monthly reaches the card through **exactly one field,
`byCat`**, and through no total at all.

| from | carried as | notes |
|---|---|---|
| `yf.start[year]` | `stats.start` | |
| Yearly rows | `stats.end/saved/invested/moved/offPaper/growth` | End = start + Yearly income − Yearly expenses |
| Yearly rows | `mInc` / `mExp`, twelve months each | allocations excluded from `mExp` |
| Yearly rows | `exp` / `inc`, per category | a category off the configured list is **kept** if money is against it; a configured one with nothing against it is dropped |
| Monthly rows | `byCat`, category × 12 | allocations included, under the **bill's** month; `Bill Payment` excluded, as on the Monthly tab |
| Contributions tab | `contrib` | read at seal time and stored, because contributions keep being added afterwards |
| computed | `highlights` | stored whole, not re-derived |

**Left behind, each one deliberate:**

- **The budget** (`yf.planned[year]`). The highlights were computed from it at seal time, but
  the figures are gone, so a sealed card can never show budget against actual again.
- **All row-level detail** — no dates, descriptions, amounts or who. A summary by design.
- **The configured category lists** (`yf.cats`), so a category that was set up but never used
  leaves no trace.
- **`me.rules`, `me.imported`, `me.chartCats`** — settings rather than data for that year.
  `chartCats` especially: the trend's category choice must not be frozen into the record.

**Three things that were wrong here, and how they were closed:**

1. **`entries` counted Yearly rows only.** A year with 8 Yearly and 8 Monthly rows sealed as
   `entries: 8`, on a card whose own body showed a grid built from the other 8. It now counts
   every row in the year, and `entriesYf` / `entriesMe` keep the split, so the card reads
   "Sealed · 16 entries · 8 yearly · 8 monthly". Records sealed before this keep their old
   number — an archive is a snapshot — and re-archiving the year corrects it.
2. **A Monthly *income* row reached nothing.** `yfTxns()` excludes `tab==='me'` and
   `meMonthlyByCat()` keeps expenses only, so it was in neither `mInc` nor `byCat` nor any
   total. It is now carried in **`meInc`** (twelve months) and stated under the grid, with
   its figure, only when there is some. It is deliberately **not** folded into `mInc`: End
   models a bank balance driven by the Yearly tab, and moving it would make the archive
   disagree with Yearly. Worth knowing that **the Monthly tab also hides these rows** —
   `meTxns()` filters to expenses — so the archive is now the only place that money is
   visible at all. Neither Monthly row-creator can make one (both hardcode `type:'expense'`),
   so it takes an import or an older file.
3. **The card described two pots of money and did not say so.** Monthly spending appears in
   the grid and in no total above it, which is the Yearly model working as intended rather
   than a bug — but nothing on the card said as much, so the two halves looked like they
   should add up. The grid now carries a line: *detail inside the figures above, not spending
   on top of them.*

Both notes use `.ay-bnote` and set **no colour, size or leading of their own**. `#archiveView
p` is an id selector and beats a class, so all prose on this tab is already on one spec;
declaring them again would lose silently and leave two specs claiming one role.

### Tuning the Archives colours by hand

Eleven variables on `:root`, together, so they appear when you inspect `<html>` and can be
edited live in DevTools. **Everything else is derived from them** — nothing about the card,
the bars or the year numerals carries a second copy of a colour.

| variable | what it does | default |
|---|---|---|
| `--arc-bar-in` | the income bar | `var(--yf-inc)` — Yearly's blue |
| `--arc-bar-out` | the expense bar | `var(--yf-exp)` — Yearly's orange |
| `--arc-card-a` | expanded card, gradient stop 1 (top-left) | `rgba(74,110,255,.22)` |
| `--arc-card-b` | expanded card, stop 2 (middle, 46%) | `rgba(52,86,200,.17)` |
| `--arc-card-c` | expanded card, stop 3 (bottom-right) | `rgba(130,165,255,.10)` |
| `--arc-card-sat` | how hard the card saturates what is behind it | `185%` |
| `--arc-yr-col` | the year numerals' colour | `#fff` |
| `--arc-yr-hi` | the year's gradient level at its lit peaks, **open** | `87%` |
| `--arc-yr-lo` | the year's gradient level at its troughs, **open** | `41%` |
| `--arc-yr-hi-row` | the same, for a card that is merely **listed** | `95%` |
| `--arc-yr-lo-row` | ditto | `52%` |
| `--arc-yr-edge` | the hairline outline around the glyphs | `34%` |
| `--arc-yr-angle` | which way the sheen runs across them | `168deg` |

The bars' lit top, translucent body and rim are mixed FROM the two bar colours with
`color-mix()` in `#archiveView`. **They used to be hardcoded `rgba`, which meant changing
the bar colour did nothing** — the frosted fill ignored it. Tune the *look* (how light the
top, how sheer the body) with the percentages in `#archiveView`; tune the *colour* on
`:root`.

**The three gloss percentages are `39 / 62 / 48`** — lit top, body alpha, rim. They started
at `52 / 46 / 62`, which read as glass floating above the card; this is about three fifths
of the way from there to a matte bar, so the bars still have form but sit *on* the surface
rather than over it. Two things learned by rendering the range rather than reasoning about
it: the three must move **together**, because they are one material and sliding the body's
alpha alone stops the bar reading as a single object; and below roughly `43 / 56 / 52` the
change is not visible at all on a card this dark, so the useful steps are large.

**The year numerals are a gradient clipped to the text**, so what reads as glass is the
gradient's *level*: `--arc-yr-hi` where it catches the light, `--arc-yr-lo` where the card
shows through. Raise both and it goes solid white; lower both and it dissolves into the
card; widen the gap and the sheen gets harder. The six stops in `.ay-yr` are mixes of
`--arc-yr-peak` and `--arc-yr-sheer` (derived in `#archiveView`) at the percentages where
each one used to sit between `.41` and `.87`, so the *shape* of the sheen lives in the rule
and its *strength* on `:root`. Keep the colour white unless a tinted year is wanted — the
stops once mixed cool greys (`#E2E8F1`, `#CBD4E1`, `#B0BBCC`) and read muddy rather than
sheer.

**A listed card's year is brighter than an open one, deliberately.** Open, the numerals sit
on glass with a blue card behind them, so sheer troughs read as glass. Shut, there is no
glass behind them at all — only the page — so the same alphas read as grey. `.ay:not(.open)
.ay-yr` therefore swaps in the `-row` pair. The derivation of `--arc-yr-peak`/`--arc-yr-sheer`
had to **move from `#archiveView` onto `.ay-yr`** to make that work: a custom property is
substituted on the element that *declares* it, so peak and sheer resolved on the ancestor
inherit down already fixed and an override of `hi`/`lo` further in does nothing at all.
Declared on the same element the override targets, the cascade settles `hi`/`lo` first and
the two ends follow. Measured both states: shut reads `.95/.52`, open `.87/.41`, and one card
opening leaves the other alone.

**Every card stop needs an alpha.** `--arc-card-a/b/c` are `rgba`, and a value written
without one — `rgb(36 65 119)` — is fully opaque, so the glass stops being glass wherever
that stop dominates. The alpha is load-bearing, not decoration: see the shade-drift note
below before raising it.

`tests/check-yr.js` measures all of this — it diffs the numerals against the previous build
and then moves each knob to prove it is wired. It is a hand-run diagnostic, not part of
`run-all.sh`. Two things it had to learn the hard way: **freeze the animations first**, or
the decorative waves move between two screenshots and ~20 levels of noise look like a
result; and `getComputedStyle` leaves `color-mix()` **unresolved** inside
`background-image`, so a regex over it finds nothing and every assertion built on it passes
vacuously (bug class 18 again). Resolve colours through a probe element's
`background-color` instead.

### How an Archives card is built visually

**One sheet of glass, not four.** The card is a single frosted surface; the header is the
only thing raised off it. Boxing each section turned one card into a stack of four, so the
sections are told apart by a hairline (`.ay-sec + .ay-sec`) and a single heading style
instead. **Highlights is the one exception** — it is commentary rather than figures, so it
keeps a pane of its own (`.ay-hlbox`), one pane around the whole list rather than one per
point.

Three measurements the whole body is built from, and nothing should introduce a fourth:
heading `margin-bottom:12px`, section gap `24px`, column gutter `22px`.

**The card's shade must not depend on what else is open.** A card looked light alone and
rich when a second one was open beside it. **Two explanations were offered and both were
wrong**, which is the part worth remembering:

1. *viewport position against the fixed `.archivefield` art* — disproved: the top card holds
   the same position either way, yet its own pixels moved;
2. *the translucent background letting the backdrop through* — disproved: neutralising the
   blend alone took it from 7.56 to 0.38 with that line untouched.

The cause is **`mix-blend-mode:plus-lighter` on `.ay-yr`**, which blends against the
backdrop root `backdrop-filter` establishes, so the numerals — and the compositing around
them — moved with whatever was behind the card. Pixel-diffing the top card alone against
the top card with another open:

| | mean | max |
|---|---|---|
| as shipped | 7.56 | 25 — the reported bug |
| blend neutralised | **0.55 – 0.96** | 12 – 22 on isolated glyph edges |

`.ay-yr` is now `mix-blend-mode:normal`, and its fill is **pure white at varying alpha**
rather than the cool greys it carried before (`#E2E8F1`, `#CBD4E1`, `#B0BBCC`) — those were
why it read muddy rather than glassy. With the card behind now blue, **the alpha is the
glass**: peaks at `.87` keep it reading white, troughs at `.41` let the blue through. If it
needs tuning, move the alphas, not the colour. It keeps its gradient, clip and bevel; what it
loses is reacting to the backdrop. **The Option B tint is untouched and must stay that
way** — the colour was verified identical to B afterwards, to 0–1 per channel.

Opaque backgrounds were built and measured as an alternative and are **rejected**: they do
stabilise it, but they flatten the card, because the variation across it *is* the art
showing through, and three gradient stops cannot reproduce an image.

**Every `<defs>` id in a bar chart is suffixed with the archive's id.** Two open cards each
emitted `arcGi` / `arcGo` / `arcGlow`, and `url(#arcGi)` resolves to the FIRST match in the
document — so the second card's bars were painted with the first card's gradients. Harmless
only because both cards carry identical tokens; it would break the moment they did not.

**`+ Dummy year`** sits left of `+ Add year` and fabricates a complete, sealed-looking
record — `arcDummyRec(year)` — without reading or writing a single ledger row. It exists to
look at the layout with several years on screen. Three things make it safe:

- the record carries `dummy:true`, and **`arcAutoSeal()` steps over it**, so opening the app
  cannot replace test data with real figures;
- the card says `Dummy · test data only` in amber, so a fabricated year can never be read as
  a sealed one;
- the figures come from `Math.sin` seeded on the year, not `Math.random`, so a year always
  renders identically and two years cannot coincide.

Each press walks back from the newest free year, so presses accumulate rather than fight
over a slot. Clear data → Archives removes them like any other record.

**Only `.ay.open` carries glass.** A collapsed card is a flat `rgba(255,255,255,.022)` with
no `backdrop-filter`, so it is unaffected by any of the above — and it is harder to read
wherever the backdrop's light sweep crosses it. Known, not yet addressed.

**Highlight colours are keyed on what the card SAYS**, via `ARC_HL_TONE`. The `tone` field
`yfHighlights()` emits is too coarse on its own — "Over budget" and "Biggest expense" are
both `exp`, and only the first is a warning. Five colours:

| | tokens | cards |
|---|---|---|
| alarm | `--hl-alarm` red | `deficit`, `over`, `climb` |
| spending | `--hl-spend` amber | `peakExp`, `oddExp`, `topCatExp`, `bigTx` |
| good news | `--hl-good` green | `peakInc`, `lowExp`, `bestSave`, `under`, `topCatInc`, `oddInc` |
| neutral | `--hl-info` blue | `rate`, `who` |
| contributions | `--hl-contrib` teal | the stored contributions line |

`arcSnapshot` keeps each card's `key` for this. Archives sealed before it existed carry no
key, so `arcHlTone()` falls back to `tone`.

**The money pair is `--arc-in` / `--arc-out`, and they ALIAS Yearly's `--yf-inc` /
`--yf-exp`** — the same blue `#38BDF8` and orange `#F97316`, pointed at rather than copied,
so the two tabs cannot drift apart. The `-hi` stops (`#91DBFB` / `#FCB27F`) are those two
mixed 45% toward white, for the bar gradient only.

An earlier note here said *not* to use Yearly's tokens on this panel. That was wrong, and
the trail is worth keeping: cyan/red, emerald/crimson, turquoise/magenta, lime/vermilion and
jade/gold were each built and measured before it became clear the hue was never the problem.

**The surface was the problem, not the palette.** Four separate palettes were rendered and
measured before this was understood. The glass behind the chart samples at **hue 218–222**
— it is blue, not the indigo it looks — and swings **×1.77 in luminance** across one panel
(`#0D1E3B` at its darkest, `#2D457A` where the specular streak crosses). Two consequences:

- every cyan, teal, turquoise and jade tried was a *neighbour* of the background, 20–40°
  away, so it sat in the surface rather than on it;
- no fixed bar colour can hold contrast across a ×1.77 swing — it reads on the left and
  washes out on the right, which is what "dull" and "off track" actually were.

A plate under the chart was built and measured as the fix — `.ay-mid` with a flat dark
background — and it worked: swing **×1.77 → ×1.24**, worst-case contrast **6.64 → 10.58**
(income) and **2.93 → 4.67** (expense), where "worst" is each bar against the *lightest*
point of the surface it sits on.

**It was then removed by request**, because it boxed a section inside a body that is
deliberately one uninterrupted sheet. The numbers above are therefore what the chart
*could* have; what it has is 6.64 / 2.93 on a surface that swings ×1.77. That is an
accepted trade, not an oversight — do not re-add the plate as a "fix" without asking.

What carries the bars instead is independent of the surface, and must not be removed:
**full opacity**, a **vertical gradient** from the `-hi` stop, and a **glow in each bar's
own hue**.

`fill-opacity:.92` was muting every bar by 8% before the glass reached it; a flat mid-tone
fill on a lit surface reads as a painted rectangle however well the colour is chosen. Those
three — full opacity, the gradient, the glow — are what make these bars read. Do not remove
them in the course of changing a colour.

**The 12-month trend draws ONE line**, for one category chosen with radios in the gear
(`sparta.arcChartCat`, a device preference — see the rollover rules above for why it is not
in the record). Default `Groceries`, falling back to the year's biggest category when the
ledger has no such name. Four overlapping lines turned the year into something to decode
rather than read.

### Archives housekeeping

`RESET_CLEAR.archive()` empties the records and **does not touch the ledger** they were
taken from — an archive is a copy, so losing it loses the snapshot and nothing else.
`archives` rides in `corePayload()` / `applyPayload()`, so a phone sees the same sealed
years. Rendering is one delegated listener on `#arcList` guarded by `box.dataset.bound`;
the cards are rebuilt wholesale on every render, so anything bound per-card would both die
with it and stack up.

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

### `sparta.updatedAt` decides who wins a reconnect

`fbConnect` picks a winner with `remoteStamp(remote) >= localStamp`, where `localStamp` is
`state.bootStamp` — the timestamp this browser had **on load**, frozen so startup
migrations cannot fabricate a fresh one. The cloud wins ties.

Every store that can hold user data calls `touchUpdatedAt()`: `persist()`, `yfPersist`,
`mePersist`, `planPersist`, `notesPersist`. **All five, not one.**

**An automated save is not a user edit.** `automated(fn)` raises `fbAutomated` for the
duration, and `persist()` then writes to disk without touching `updatedAt` or calling
`markUserEdit()`. Used by the 60-second price refresh and the hourly history compaction.
Without it a tab left open all day re-stamped itself every minute, so on its next connect
it outranked a phone that had genuinely been used at lunchtime and pushed its stale ledger
over the top — nothing the user did had changed, yet the browser claimed otherwise. Same
principle as `fbBooting`: an automatic action must never masquerade as a deliberate one.
History still reaches the cloud, by its own per-day `cloudSavePoint()` path. It used to be bumped by
`persist()` alone — Dashboard and Contributions — which meant an evening of Yearly work
never moved the stamp, and a trivial Dashboard change on another device outranked that
evening and overwrote it. If you add a sixth store, it calls `touchUpdatedAt()` too.

`BOOT_HAD_LOCAL_DATA` reads `localStorage` **directly**, not through `store`, and that is
deliberate: with keep-data-here switched off it finds nothing, sets `localStamp = 0`, and
the cloud wins unconditionally — exactly right for cloud-only mode.

### Known limitation, by design
**No live listener.** Firebase is read once on connect, not watched continuously. Two devices open simultaneously will not see each other's changes until reload. Last-writer-wins, no merge. This was an explicit trade-off (user confirmed they don't need real-time multi-device sync) — do not add a live listener without discussing bandwidth/conflict implications first.

### SDK loading — do not reintroduce a race
`loadFirebaseSDK()` loads `firebase-app-compat.js` then `firebase-database-compat.js` **strictly sequentially** (second script's creation is chained off the first's real `onload`, not a fixed timer). An earlier version used a hardcoded 150ms delay between the two script loads, which silently failed on slower connections since the second script could execute before `firebase` existed as a global. Fixed with a proper `Promise` chain + a 12s timeout.

---

### A tab left open overnight — a real data-loss incident, and what now stops it

**What happened.** A laptop tab was left open and the machine slept. That evening a phone
added five rows, which went to Firebase correctly. Next morning the laptop woke and those
five rows were gone from the cloud — **with nobody touching the laptop.**

**Why.** Three things lined up:

1. There is **no live listener**, so a tab open since yesterday still holds yesterday's
   ledger and cannot know another device moved on.
2. `fbUserEdited` is **sticky for the life of the tab**. An edit made yesterday morning was
   still authorising writes a day later.
3. `persist()` called `cloudSaveDebounced()` **outside** the `fbAutomated` guard. The
   earlier `automated()` work stopped a background save from *winning* a merge by leaving
   `updatedAt` alone — but it never stopped it *writing*, and `core` is `set()` wholesale.

So the 60-second price timer resumed on wake, `persist()` ran, the sticky flag let it
through, and that tab's stale ledger replaced the phone's work. No interaction required.

**The fix, both halves:**

- **`if(!fbAutomated) cloudSaveDebounced();`** Nothing is lost by holding back:
  `coreHoldings()` strips live prices, so an automated save has nothing new in `core`
  anyway, and history points go up by their own path (`cloudSavePoint`, from `snapshot`).
- **`fbRecheckOnWake()`** on `visibilitychange` and on a bfcache `pageshow`. A tab that has
  been asleep asks the cloud before it is trusted again, and pulls if the cloud is newer.
  It only ever pulls — an older remote is left alone. `cloudSaveDebounced` re-arms while a
  check is in flight, because the write is the destructive direction and must not race it.

**The lesson worth carrying:** *not winning a merge* and *not writing* are different
guarantees. A guard that only touches the timestamp leaves the wholesale write intact.
`test-storage` §4b pins both directions — an automated save writes nothing even with the
edit flag stuck on, **and** the identical change made by a person still syncs, so the check
cannot pass by breaking sync altogether.

---

## 5a. The design scale — snap to it, do not style beside it

An audit across all six tabs (2026-10-01) found that one role — the small uppercase
label — had been implemented twenty-odd times at six sizes with letter-spacing from
.04em to .26em, alongside five corner radii, five panel paddings and five heading specs.
None of it was a decision; it accumulated. The tokens at the top of `:root` are now the
only values, and **new work belongs on the scale rather than beside it**.

| role | token | value |
|---|---|---|
| micro label (dense cards) | `--fs-micro` | 9.5px / 700 / `--ls-label` |
| label (standard) | `--fs-label` | 10.5px / 700 / `--ls-label` |
| lede (above a hero figure) | `--fs-lede` | 11.5px / 600 / `--ls-lede` |
| panel title (sentence case) | `--fs-title` | 15px / 600 / .02em |
| panel eyebrow (uppercase) | `--fs-eyebrow` | 12.5px / 700 / `--ls-label` |
| fine / dense / body / input | `--fs-fine` `--fs-dense` `--fs-body` `--fs-input` | 11 / 12 / 12.5 / 13.5 |
| panel / card radius | `--r-panel` `--r-card` | `var(--radius)` 22px / 14px |
| panel padding | `--pad-panel` | 22px |

Three things to know before changing any of it:

- **`--fs-dense` is a deliberate step, not drift.** A thirteen-column table cannot carry
  reading-size type without wrapping. It is the one place 12px is correct; everything
  prose-shaped belongs on `--fs-body`.
- **`--r-panel` aliases the pre-existing `--radius`.** Two tokens for one shape is exactly
  the duplication the pass removed — do not reintroduce one.
- **`label.dropzone` / `label.skeu-drop` opt out of the caps rule on purpose**, because a
  drop target is a sentence. Stated in the stylesheet rather than left as a silent override.

**Yearly was the biggest outlier**: 15px uppercase section headings where Monthly,
Archives and Settings all used ~12.5 for the identical role, and a third label size again.
The colour classes beside them (`.yf-h-exp` / `.yf-h-inc`) are untouched — there the colour
*is* the information.

**Archives was audited separately on the same day**, because a tab can drift inside itself
even once the global scale is in. It held **22 off-scale font sizes, 24 text colours, 6
radii and 8 gap values** — and had re-invented five greys and two whites that were all
approximations of `--text` / `--text-dim` / `--text-faint`. After: **zero off-scale sizes**,
neutral text on the three tokens, three radii (control 10 / card 14 / the 2px accent rail),
and gaps on a 4px rhythm — 0 / 4 / 8 / 12.

Two stated exceptions in that tab, both deliberate:

- **`.ay-s` keeps `gap:2px`.** A micro label and the figure it names are one unit; the
  rhythm's smallest step reads as two separate things.
- **Amounts are pure `#FFF`**, one step brighter than `--text`. That is emphasis, not drift.

The three display steps — `--fs-figure` 15px, `--fs-display` 30px, `--fs-year` 62px — exist
because a figure is not body text but still has to come off a scale. Archives previously had
14.5 / 30 / 62 sitting beside no system at all.

**`var()` resolves in SVG presentation attributes** in this engine — verified by measuring
computed `fill` on all 29 `<text>` nodes after the fold, since a silent failure there would
have turned every axis label invisible. Do not assume it; re-measure if the charts change.

`tests/audit-design.js` re-runs the audit and prints how many distinct specs are in use per
role. It is a diagnostic, not a test, so it is not in `run-all.sh`. When a count there
climbs, something was styled beside the scale.

## 5. Visual Themes (per tab, deliberately distinct)

### The Settings drawer is a two-column card grid

**The frame and the scroller are two elements, deliberately.** `#drawer` (`.panel.drawer`)
is the frame: `padding:18px` on all four sides, `position:relative`, and it never scrolls.
Inside it `.drawer-grid` is the CSS grid — `repeat(2,minmax(0,1fr))`, `gap:9px`,
`align-content:start` — and it carries `max-height:calc(75vh - 36px); overflow-y:auto`.
The subtraction is the frame's own padding, so the whole block still lands inside 75% of
the screen.

Splitting them is not tidiness, it is what makes the rim light possible: an absolutely
positioned ring inside a scroll container **scrolls away with the content** (bug class 16). The cap is stated rather than aimed
at, because the same markup is 70% of a tall desktop screen and 130% of a laptop one; the
grid is what keeps most screens from needing the scrollbar at all, by halving the height of
the small sections instead of squeezing them.

**Why a grid rather than more trimming.** Seven sections were using five different layout
systems (`.fbrow`, `.reset-line`, `.hform`, `.taborder-line`, `.basegrid`) separated by
`<hr>` rules, so there was no repeating rhythm for the eye to lock onto and every section
carried identical weight. An earlier pass made the panel *shorter*, which is not the same
as *composed* — it removed breathing room without adding structure, which is why it then
read as congested. Two-up rows buy back the room that padding and a real type scale need.

Every section is a `<section class="set-card">`; the `<hr>` rules are gone, because the
cards do that job. `.set-card.wide` spans both columns, and the running order is fixed so
the flow is deterministic:

| Card | Span | Why |
|---|---|---|
| App lock | 1 | one row, with its buttons on the card floor |
| Yearly starting balance | 1 | two rows |
| Tab order | **2** | six pills and the reset on one line |
| Dashboard shortcuts | **2** | keeps the four controls on one line |
| Cloud sync | **2** | a 60/20/20 grid, two rows deep |
| Clear data | **2** | eight items on one line |

Under 760px it collapses to one column and `.set-card.wide` drops back to `grid-column:auto`.

**The gaps were halved, then taken back up by a quarter.** Halving them
(grid 14→7, frame 16→9, card 14/16→11/12, heading 11→6, inner gaps 10→6) took the content
**696px → 580px** and got the panel under the scrollbar. The ×1.25 pass after it
(grid 7→9, card 11/12→14/15, heading 6→8, inner gaps 6→8) put it at **650px** with the
frame's even 18px — which fits from about an **870px-tall window** up rather than 800px.
That trade was made knowingly: the panel reads as one block with room to breathe, and the
windows it costs are ones where the 75% cap was close to binding anyway. `test-storage`
§2c pins `content <= 660`. **Below ~870px of window the cap is itself the binding
constraint** and a scrollbar is unavoidable — that is the cap doing its job, not a layout
fault, so do not chase it by trimming further.

**The rim light.** `.drawer.open::after` is a conic gradient clipped to a 1.5px band by two
masks composited apart (`mask-composite:exclude`) — that paints the *border* rather than the
box, which a gradient background cannot do. It sweeps because the angle lives in a
**registered** custom property (`@property --orbit{syntax:'<angle>'}`); an unregistered
`--var` is a string to the animation engine and would jump from 0 to 360 rather than sweep.
There is a `@supports not` fallback that parks it, and it honours
`prefers-reduced-motion`. It is on `.drawer.open` rather than `.drawer` so nothing animates
behind a closed panel (bug class 8).

**The three Cloud sync buttons sit at 36px**, matching Set PIN, via `.syncgrid>.btn
{align-self:center}` with `.sg-left{align-self:stretch}`. They are grid items in a two-row
grid whose row heights are set by `.sg-left` spanning both, so the default `stretch` made
them ~50px tall — taller than every other button in the drawer for no reason anyone chose.

**Clear data goes last**, where a destructive control belongs, and it no longer carries a
warm border tint — being last says it better than colour did, and `.set-card.danger` is
gone with it. The amber stays on the **Cloud too** tick alone, which is the only control
here that reaches past this browser into the Firebase copy.

**The two paired cards fill to the same floor.** They are grid items, so they *already*
stretch to equal height — which is exactly why asserting `heightA === heightB` proves
nothing and why `test-storage` §2d measures the gap under each card's last child instead
(see bug class 14). The filling is what needed building: `.set-card` is a flex column,
App lock's `.pin-actions` takes `margin-top:auto` to sit on the floor, and Yearly's
`.hrows` takes `flex:1` with `justify-content:space-between` so its two rows spread over
whatever height the row hands it. Without those, App lock trails off into ~9px of dead air
at 820px wide.

**Live prices is no longer a card.** It was a whole section carrying one fact, so it now
reads as `Live prices (Finnhub)  Yes — live` / `No — …` in a `.sec-aside` on the right half
of the Cloud sync heading, with its setup prose folded into that card's help. Both its
buttons went: *Get a free key* was an external link the help text already covers, and
*Refresh prices now* went with it — prices still refresh every 60s and on load. **Deleting
a control means deleting its handler**; `$('refreshNow').onclick` was left behind on the
first pass and threw `Cannot set properties of null` at boot, which stops the whole init
script and leaves the drawer half-built (bug class 15).

**Cloud sync is a 60/20/20 grid** (`.syncgrid`), two rows deep. `.sg-left` spans
`grid-row:1/3` down the 60% column and holds *both* status rows — the connection and
keep-data-here — inside one dark container with a hairline between them, because they are
two halves of one fact rather than two unrelated strips. Test connection takes the
remaining 40% on row 1 (`grid-column:2/-1`); Push and Pull take 20% each on row 2. The old
`.sync-actions` flex-quarters rule is gone.

Three rules make the cards work and are each load-bearing:

- **`.drawer .set-card .fbrow` is flattened** (no border, background or padding). A box
  drawn inside a box reads as clutter, and flattening gives back the padding, which is most
  of what the cards cost in height.
- **`.drawer .set-card .fbrow>div:first-child` is `flex:1 1 auto;min-width:0`** and
  `.row-actions` is `flex:0 0 auto`. The buttons are fixed-size; the label is the part that
  can give. Without this the label held its width, the actions wrapped underneath, and a
  half-width card ended up with its two buttons stacked over a column of dead space.
- **One control height, 36px**, across `.drawer .btn`, inputs, selects, `.reset-row`,
  `.taborder-row` and `.keepdata`. Pills sat at ~34px, buttons ~38 and inputs ~40, and that
  ragged edge was a real part of the untidiness.

Two patterns do the rest of the work, and new sections should follow both:

- **`.sec-head`** — heading, optional `.sec-badge`, and a small `.sec-i` button. Every
  instructional paragraph is a `<p class="note sec-help" id="helpX" hidden>` revealed by
  its button (`data-help="helpX"`). One delegated listener on `#drawer` handles all of
  them, so a new section needs no wiring. The button carries `aria-expanded`.
- **A quiet heading.** `.sec-head h3` is an 11.5px uppercase eyebrow at `--text-dim`, not
  the 15px display type it used to be. This makes *more* hierarchy, not less: the heading
  names the card and then gets out of the way, leaving the row titles as the loudest thing
  inside it.
- **One line per section where it fits.** Clear data puts its six tab pills, the cloud tick
  and the button on a single flex line (`.reset-rows` is `display:contents` so the pills
  join their parent's line rather than forming a nested box). The pills deliberately match
  `.taborder-row`, with a checkbox where Tab order puts its position number, so the two
  lists read as one family. They carry `flex:1 1 auto`, so they **stretch to fill** the
  line with `#resetGo` (`flex:none; min-width:104px`) on the end, the slack shared in
  proportion to each name so "Contributions" stays wider than "Plan" without either
  truncating. **Size the checkbox explicitly** (`width:15px;height:15px;min-height:0`) —
  `.drawer input{min-height:36px}` is a blanket rule and it was sizing the *checkbox*
  inside each pill, which is the real reason these stood 42px tall against Tab order's 35px
  when they were supposed to be the same pill. Dashboard shortcuts pairs each amount
  with its own button in `3fr 2fr 3fr 2fr`, i.e. 30/20/30/20. Cloud sync uses an explicit
  grid rather than flex ratios — see `.syncgrid` above.

**Instructions live in the help panel, not in `alert()`.** `fbSetup` and `fbInfo` were two
popups holding the Firebase setup steps and the stored-shape rundown; both now read as
prose under the Cloud sync `i`, where they can be scanned rather than dismissed. Anything
similar should go the same way rather than adding a button.

**Removed as redundant:** *Clear holdings* (Clear data → Dashboard does it) and *Clear old
history*. The latter trimmed the oldest 20 snapshots off a list `compactHistory()` already
prunes hourly — every past day collapses to one closing point, and `snapshot()` caps the
list at 4,000, which is about eleven years at one point per day.

`.sec-i` is in the 560px tap-target rule, so it keeps a 28px hit area on a phone.

**Scrollbars are glass everywhere**, not the browser's white: `*{scrollbar-width:thin;
scrollbar-color:rgba(255,255,255,.20) transparent}` plus a `::-webkit-scrollbar-thumb` at
`rgba(255,255,255,.15)` with `border:3px solid transparent;background-clip:content-box` for
the inset. It is global rather than drawer-scoped, so every scroller in the app matches.
The thinner bar gives content ~3px more width — enough to move layout pixels, which is why
`test-mobile` §8 compares ribbons against each other rather than remembering numbers
(bug class 12).

**Chips that fill:** Income and Expense on Yearly fill with `--yf-inc` / `--yf-exp` and go
near-black, the same idiom as `.seg button.active.poo`. Both segs carry it — `#yfModeSeg`
in the year bar and `#yfFilterSeg` by the transactions table — since one filled and one not
reads as a bug. **`.seg button` has `transition:all .2s`**, so a test reading
`getComputedStyle().color` straight after a click gets a mid-interpolation value; wait it
out (this cost a real debugging detour — see bug class 11).

| Tab | Theme | Notes |
|---|---|---|
| Dashboard | Glassmorphism, aurora backdrop | Original design |
| Contributions | Glassmorphism | Teal/violet |
| Yearly Finance | Glassmorphism, deeper blur | `#yearlyView .panel` — 24px blur |
| Monthly Expense | iOS-style ultra-transparent glass | `#monthlyView .skeu-panel` (class name is legacy from an earlier skeuomorphic design, now glass — 40px blur, radial highlights, refracted rim) |
| Archives | **Minimal, flat, indigo `#8B93F8` accent** | No blur, no shadow, 1px hairlines. **This is the theme to extend when building Archives out** — do not add glassmorphism here, it was deliberately made distinct |
| Plan | Teal glass over `#071520` | `.plan-skin`, with a `.planfield` backdrop of drifting wave bands and planning motifs |

**Yearly's ribbon is lengthened as ONE object and dissolves at its tail.** All 64 paths end
at `x=1400` in local coordinates, so before this they all stopped at the same place and it
read as a cut. Two additions, and the paths themselves are untouched:

```
transform="scale(1,1.27) rotate(48 980 60) translate(760,0) scale(1.145,1) translate(-760,0)"
                                           ^ pivot the stretch at the paths' own start ^
```

- The inner `scale(1.145,1)` runs **after** the rotate, so it stretches along the ribbon's
  own axis rather than the screen's. `scale(1,1.27)` is unchanged: it is in the parent
  space, post-rotation, and is what gives the vertical reach. The ribbon now reaches **81%**
  down from 71%.
- **The pivot is load-bearing.** A bare `scale(K,1)` works about the origin and slid the
  whole ribbon right (left edge 660 → 711px at K=1.10). Pivoting at local `x=760`, the
  paths' own start, means only the far end travels and the start does not move at all.
- The tail fade is a `<mask>` with a `userSpaceOnUse` gradient on an **inner** `<g>`, so it
  resolves after the rotate and fades along the ribbon. On the outer group it would fade
  along the screen axes instead — which dims the layer near the bottom of the window and
  leaves the hard end exactly where it was.

**A failed attempt worth not repeating:** extending each of the 64 paths along its own exit
tangent. Every path leaves at a different heading (endpoints alone span `y = -57 … 238`), so
extrapolating them independently makes them **stop being parallel offsets of each other** —
they splay into a fan with widening, uneven gaps. The nesting *is* the effect. Anything that
touches the paths individually pulls them apart; `test-mobile` §7 now asserts all 64 carry no
transform of their own, which is what keeps that from coming back.

Each tab has an animated SVG background field (`.tickerfield`, `.cashfield`, `.financefield`, `.monthlyfield`, `.archivefield`, `.planfield`) toggled via body class, opacity-faded in/out over 0.7s. Yearly, Monthly and Archives also carry a fluid wave layer (`.wv-yf`, `.wv-me`, `.wv-arc`); Yearly's is stretched `scale(1,1.27)` ahead of its rotate so it reaches ~70% down the viewport without moving sideways. **Fading a field out is not enough — each also needs `animation-play-state:paused` when hidden** (bug class 8). Icons drift slowly (`tkdrift` keyframe, 30–38s cycles). If Archives gets real content, consider adding a matching `.archivefield` icon set (vault, ledger, filing cabinet motifs already partially exist — check `#archiveField` in markup).

**Each holding carries an open-in-a-new-tab arrow** to that ticker's quote page.
`quoteHref(sym)` builds it from `quoteBase()`, which is `sparta.quoteUrl` or
`https://ca.finance.yahoo.com/quote/` when unset, and strips then re-adds the trailing
slash so `.../quote` and `.../quote/` resolve alike. The base is editable on the Dashboard
beside Import holdings.

Three things it has to keep doing:

- **`rel="noopener noreferrer"` on every one.** `target="_blank"` without it hands the
  opened page a `window.opener` back into this one.
- **The scheme is checked separately from `new URL()`.** That constructor happily accepts
  `javascript:` and `mailto:`, and a `javascript:` href behind a `target="_blank"` anchor is
  not a thing to leave in the page. A rejected value must also leave the previous base
  standing rather than blanking it.
- **It is a device preference, not portfolio data** — in `STORE_DEVICE` beside `sparta.ccy`
  and `sparta.tabOrder`, so it is not namespaced per database and Clear data never takes it.
  The trade is that it does not follow you to another browser, same as the currency.

**The Dashboard chart carries a dot per point and reports its value on hover.**
`compactHistory()` already keeps exactly one closing point per past day, so on 1W / 1M /
All every point *is* a day end — the data needed nothing. Three things make it work:

- **Dots are zero-length paths, not `<circle>`s.** The SVG is `viewBox="0 0 640 190"` with
  `preserveAspectRatio="none"`, so x and y scale **independently** and a circle renders as
  an ellipse — about 10% wide, which nobody notices on one end-of-line dot and everybody
  notices on thirty. A zero-length path with `stroke-linecap:round` draws a dot of diameter
  = stroke-width, and `vector-effect:non-scaling-stroke` measures that width in **screen**
  units, so it stays round at every panel width with nothing to recompute on resize.
- **Hover is a nearest-point lookup over one transparent `<rect>`**, not a listener per dot.
  1D is today's raw intraday snapshots — one a minute with a tab left open — so per-dot hit
  targets would be unusable and dots themselves are suppressed above 40 points.
- **The handlers bind once, to the wrapper.** `drawChart()` replaces `svg.innerHTML` on
  every render *and* every 60s price refresh, so anything bound inside it dies each time and
  re-binding stacks up: measured at **36 listeners after a dozen redraws** with the guard
  removed. `dashPts` / `dashXof` / `dashYof` are module-level and refreshed by each draw,
  which is what lets the handler outlive the markup it reads.

The tooltip formats through `fmt()`, so it cannot disagree with the hero figure above it,
and a point taken **today** is labelled with its time rather than called a close. Every
redraw hides it first — a tooltip surviving a range switch would be a plainly wrong number
sitting on screen. **A day the app was never opened has no snapshot and so no point**; the
line spans the gap rather than inventing a value for it.

**`input[type=date]` is not a text box and must be told so.** iOS Safari renders it as a
native control: it ignores most of the shared padding, sizes itself to its own idea of the
content, centres the value, and lets its min-content push past its grid column. On Yearly's
add-transaction form that meant a date field shorter than the Type select beside it and
spilling over the card's right edge. Three things fix it, all needed:

- `-webkit-appearance:none;appearance:none` plus `text-align:left`, to put it back under the
  same box rules as every other field;
- **`min-width:0` on the input itself**, not only on its `.hform` grid cell — the cell rule
  stops the *column* being pushed wide, but the control's own min-content still overflowed it;
- **an explicit `height:calc(1.25em + 24px)`** (and `+ 22px` in the `<=560px` block, where the
  padding drops to 10). Even with the native appearance off it keeps ~2px of intrinsic content
  height that no pseudo-element rule reaches — `::-webkit-date-and-time-value` and
  `::-webkit-calendar-picker-indicator` were both measured and neither moved it. The `em`
  tracks whichever font-size regime applies (14px, 13.5px, or the 16px used to stop iOS
  zooming on focus), so only the padding constant needs restating.

`line-height:1.25` is now stated on `input,select,textarea` for the same reason: left at
`normal` it resolves from each control's own font metrics, which is how three fields in one
grid ended up three different heights. **`test-mobile` §9 carries a written limit** — the
height and appearance checks fail against the unfixed file, but the overflow one passes
either way, because Chromium's date control has a far smaller min-content width than iOS
Safari's and cannot reproduce it. That case is only confirmable on a device.

**`min-width:0` is the fix for text escaping a grid, and it is needed at EVERY width.**
A grid item defaults to `min-width:auto`, so its min-content can push a `1fr` column past its
share. A pasted URL offers no break opportunity, so its min-content *is* the whole string:
the column grows to fit it and any `overflow:hidden` + `text-overflow:ellipsis` on the child
never gets the chance to engage. Plan's `.pl-row` had exactly this — `.pl-nt` and `.pl-nm`
already carried the ellipsis, and a note ran **462px past the row's right edge at 1360 wide**.
The `@media(max-width:560px)` block had carried `min-width:0` since the phone pass, which is
why it only ever showed on a desktop. It is now on `.pl-row>*` and `.pl-nmrow` unconditionally.
**When a truncation rule appears not to work, suspect the container before the rule** — this
is the third component to hit it, after `.hform` and `input[type=date]`.

**The Yearly monthly chart's axis rounds up to the next 1,000** — `Math.ceil(maxM/1000)*1000`,
with `maxM` floored at 1,000 so an empty year does not collapse. It used to start at 5k and
**double** until it cleared the tallest bar, which meant the only tops on offer were
5k / 10k / 20k / 40k: a $7,237 month was drawn against a 10k ceiling and used **72%** of the
height it had, making the graph look flatter than the numbers were. It now uses 90%. The
midpoint gridline is `top/2` and follows along, so an odd thousand gives a half-thousand
label (`$4.5k`) — that is fine and deliberate, not a rounding bug. `test-yf-highlights` §8b
pins the boundaries (7,237 / exactly 8,000 / 8,001 / a tiny year) and measures the bar's
fill, and every one of those checks fails against the old doubling.

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
9. **A destructive action that quietly reaches the cloud.** Every persist path ends in
   `cloudSaveDebounced()`, so anything that empties local state pushes that emptiness up
   and destroys the cloud copy too. Clearing data defaults to this browser only, behind
   `fbLocalOnly`. Any new bulk operation needs the same guard, and its own dedicated flag
   rather than borrowing `fbApplying`, which means something else.
10. **A label that outgrows what the code does.** "Reset all data" cleared Dashboard and
   Contributions and nothing else, for as long as it took Yearly, Monthly, Plan and Notes
   to be built around it. When a store is added, grep the *reset* and *export* paths as
   well as the render paths — those are the ones with no visible symptom when missed.
11. **Measuring a value that is still animating.** `getComputedStyle().color` read straight
   after a click returns a value part-way through `transition:all .2s`, which cost a real
   debugging detour on the Income/Expense chips: the background looked applied and the text
   colour looked ignored, from one declaration block. Same shape as `scroll-behavior:smooth`
   making `window.scrollTo` measurements read mid-scroll. Wait out the transition, or read
   the rule rather than the computed value.
12. **A measurement pinned to remembered pixels rather than to the property.** The Yearly
   wave test asserted `left === 657 && right === 1346`, which quietly also asserted "the
   viewport is exactly this wide" — so thinning the scrollbar by three pixels failed it,
   with nothing about the wave having changed. It now measures the same ribbon with the
   stretch removed and asserts the horizontal delta is zero, which is the claim being made.
   Sibling of bug class 11: assert the relationship, not a snapshot of the numbers.
13. **A fixture pinned to the calendar rather than to "today".** `test-plan.js` used four
   literal 2026 dates with exactly one of them in the past — true right up until the clock
   reached the second one, at which point the suite failed one morning with nothing about
   the app having changed. Anchor date fixtures to offsets from today, and compute them in
   the page so they match `isoLocal()`'s timezone rather than the runner's.
14. **A measurement taken while the element is `display:none`, or of a value the layout
   pins anyway.** Two shapes of the same mistake — an assertion that cannot fail. Everything
   in the Settings drawer reads 0×0 until it is opened, so a layout assertion there passes
   without meaning anything (the sibling of bug class 7); `test-storage.js` §2b opens the
   drawer and asserts the boxes are real before trusting a single position. The subtler
   shape: two cards in one grid row **always** stretch to equal height, so a
   `heightA === heightB` check for "these cards end level" holds however the content
   behaves. §2d measures the gap under each card's last child instead, which is the claim
   actually being made. Before trusting a layout assertion, break the rule it covers and
   confirm it fails.
15. **An animated overlay inside a scroll container.** The drawer's rim light was an
   absolutely positioned `::after` on the element that also carried `overflow-y:auto`. Its
   containing block is the padding box, but it paints in the scrolled layer, so the moment
   the panel scrolled the light slid out of view and the visible top edge had no border at
   all. A decoration that frames a box has to hang off a box that does not move: the fix
   was to split the frame (`#drawer`) from the scroller (`.drawer-grid`). Check any
   `position:absolute` overlay against a scrolled parent, not just a still one.
16. **Deleting a control without deleting its handler.** Removing the Live prices card left
   `$('refreshNow').onclick=…` pointing at nothing, which threw `Cannot set properties of
   null` during init — and because that runs at the top level, everything after it never ran
   and the drawer came up half-built. A dead `$(id)` is not a dangling no-op, it is a
   boot-stopper. Grep the id before removing its markup; the suite's `no page errors` check
   is what caught it.
17. **`Math.abs()` on an already-formatted string.** `arcPct` read
   `const v = n.toFixed(1); return sign + Math.abs(v) + '%'` — `toFixed` returns a string,
   `Math.abs` parses it back to a number, and the decimal place it had just added was
   thrown away. Every percentage on the Archives cards printed as `+100%` rather than
   `+100.0%`, which looks deliberate and is not. Format last: take the absolute value of
   the number, then `toFixed`.
18. **A parity check that cannot fail.** The first version of the stacked-listener guard in
   `test-archives.js` rebound twelve times and then asserted the card ended up toggled.
   Twelve stacked listeners toggle twelve times and land back where they started — but the
   binder had already run once at boot, so thirteen fired, the parity came out *right*, and
   the check passed against a build with the guard deliberately removed. Count the
   invocations, never the final state, whenever the failure mode is "it ran N times".

---

## 9. Testing Policy

**Unit tests, not regression sweeps** — that is the standing instruction. In practice the
suite under `tests/` has become the only thing making a 6,400-line single file safe to
change, so it is kept green rather than skipped.

- `cd "Sparta Finance Tracker/tests" && ./run-all.sh` — fifteen suites, **1,082 checks**.
  Needs `node_modules` (Playwright); link it, run, then remove the link.
- Add a check when behaviour is pinned down, especially arithmetic. Every money rule in
  §0 has one, because each was re-litigated at least once.
- `node --check` on the extracted `<script>` blocks after every edit. That is not testing,
  it is confirming the file still parses.
- **Verify against the app, not against the tests written beside it.** Three audits in a
  row found bugs the suite was blind to, all in paths nobody had written a test for.

---

## 10. Known Gaps / Next Steps (as of this handoff)

- **Archives is built** (build 2026-10-01B): one card per sealed year, on iOS-style glass,
  collapsed to a travel-listing row and expanded to the year's full record — month bars,
  Highlights 45% / Expenses 27.5% / Income 27.5%, Monthly's own 12-month category trend,
  and the category-by-month grid at full width. Sealing is automatic on the first load of
  a new year, with **+ Add year** as the manual route for the year in progress. See §2 for
  the data shape and the rollover rules.
  The trend keeps Monthly's exact behaviour of drawing all twelve months, so a year logged
  only to September shows its line fall to $0 for the rest — correct for a genuinely closed
  year, and accepted as-is for the current-year preview.
- **Plan tab** exists and is built out (segments, dated items, running balance, lowest
  point) — see `tests/test-plan.js` for the behaviour it guarantees.
- No live Firebase listener (§4) — acceptable per user, don't add without asking.
- No xlsx import support (CSV only, by design — avoids bundling SheetJS in a single-file app).
- `spapp.png` is not committed next to the HTML, so the header logo, the PIN screen orb
  and the favicon 404 until you drop it in this folder. The old `file:///C:/Users/...`
  fallback was removed (browsers block `file://` subresources on any http-served page).

  **Keep the filename lowercase.** It is referenced from four places — the `icon` and
  `apple-touch-icon` links in `<head>`, `.brand .orb` and `.pin-orb` — and it broke on
  Netlify precisely because of case: their servers are case-sensitive, Windows and macOS
  are not, so the local filesystem matched `SpAPP.png` against a file actually named
  `Spapp.png` and the deployed site did not. Lowercase is the one spelling that cannot be
  got wrong on any of the three. On Windows the rename needs a temporary name in between
  (`SpAPP.png → temp1.png → spapp.png`) or the filesystem treats it as a no-op.

  A second favicon used to sit in `<head>`: an SVG data URI wrapping this PNG in a
  brightness filter. **Do not put it back.** An SVG loaded *as an image* is sandboxed and
  cannot fetch an external file, so its `<image href>` never resolved — and being declared
  after the PNG, it beat the working link and rendered nothing at all. Brightening the
  icon means editing the PNG, not wrapping it.
