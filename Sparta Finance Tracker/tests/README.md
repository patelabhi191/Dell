# Tests — Sparta AP Finance Tracker

No build step. Node + the Chromium that ships with Playwright.

```bash
cd "Sparta Finance Tracker/tests"
npm install                 # playwright only
./run-all.sh                # everything
```

| Suite | What it covers | Cases |
|---|---|---|
| `test-data.js` | Pure functions, table-driven: `meCategorise` waterfall, exclusions, dedup fingerprints, `limitFor`/`contributed`, `yfActual`, `parseCSV`, mixed-currency holdings math, the **CAD-only currency invariant**, and the one-time `migrateContribCAD` in all three branches | 45 |
| `test-ui.js` | Real interaction flows: tab routing + theme/lock state, dashboard cash & holdings & sell modal & sorting, contributions deposit/log/edit modal, yearly transaction CRUD + categories + filters, monthly shared-ledger + popover, settings drawer + tab reorder, reload persistence, PIN gate | 72 |
| `test-contrib.js` | Contributor (Abi/Poo) tracking on Contributions: `depositContrib` defaults to Abi, migration on both branches (already-tagged entries untouched, untagged entries backfilled), the yearly-backfill zero-amount guard now split per contributor/account, the old-shape `{tfsa,fhsa}` yearly-draft fallback, stacked-chart segment totals vs. `contributed()`, and the All/Abi/Poo filter — confirms it scopes the chart + deposit log but leaves the TFSA/FHSA hero cards and room-remaining untouched | 28 |
| `test-import.js` | CSV import and the trend filter: refunds/credits arriving as **negative** expenses so they offset their category (they were dropped outright before), card payments still excluded as bill settlement, `meMoney` signing negatives correctly, re-import **restoring** a row deleted or lost to a bad sync (the remembered-fingerprint list no longer blocks what is absent from the ledger), the month check warning when a statement will be filed under a different month than its dates, auto-detect vs the manual "Expenses appear as" override, and the filter popover being genuinely clickable rather than painted over by the chart | 22 |
| `test-mobile.js` | Phone layout at 390/360/320px: every open tab's controls reachable without side-scrolling (Yearly's Income/Expense filter used to sit 607px past the right edge), the tab bar wrapping so the tab list scrolls on its own row and per-tab controls sit below it, no page-level horizontal pan on any tab, the holdings table scrolling inside its own panel instead of dragging the whole page wide, and Plan rows keeping a usable name width by dropping the amount to a second line. Also covers the fluid wave backdrops on Yearly / Monthly / Archives: each layer is the first child of its field so the motif icons paint over it, stacking is wave 0 / motifs 1, every icon stays at =0.15 opacity so it reads over the brighter ground, each wave animates only on its own tab and is paused elsewhere, and none of them introduce a sideways pan | 48 |
| `test-plan.js` | Plan tab: segment create/rename/delete (delete confirms first and must not toggle the segment), starting balance, collapse/expand and that clicking the name or balance field does **not** toggle; items sorted by date whatever order they are entered in; running balance and the reported **lowest point** — the numbers most likely to be silently wrong; passed rows greyed with a clock icon yet **still fully editable** (guards "greyed out" from quietly becoming read-only); `normalizePlan()` against junk shapes; `sparta.plan` persistence and `corePayload()` round-trip; `render()` and starting-balance edits leaving focus and caret alone; the blue→`#071520` skin sampled teal→`#071520` translucent skin; and the `.planfield` page backdrop — five drifting wave bands plus five planning motifs behind the shell, the panel staying brighter than the backdrop behind it, and the field fading out AND pausing its animations on every other tab (the guard every backdrop field needs, since `opacity:0` alone does not stop animation); 60/40 split stacking below 900px | 74 |
| `test-notes.js` | Shared notepad on Dashboard + Contributions: confirms the panel is ONE element moved by `applyView()` rather than two copies (the failure this is really guarding against), point add/edit/delete with Enter and Backspace behaviour, prose box, `normalizeNotes()` against junk shapes, `sparta.notes` persistence across a reload, `corePayload()`/`applyPayload()` cloud round-trip, and that `render()` — which fires on every price tick — leaves focus and caret untouched. Also covers the Strategy 60% / **Eye on Stocks** 40% split: chip add via Enter with focus retained so tickers can be typed one after another, case-insensitive de-duping, trimming, casing preserved (not uppercased), Backspace-on-empty removing the last chip, and the split stacking to one column at 900px | 67 |
| `test-yf-me-contrib.js` | Contributor (Abi/Poo) tracking on Yearly Finance + Monthly Expense (they share `state.yf.txns`): `normalizeYF()` migration, `yfSaveTx`/`meSaveTx` add+edit paths, `meApplyImport` defaulting to Abi, and the All/Abi/Poo filter on each tab — confirms Yearly Finance's filter scopes only `#yfTxBody` (category/summary cards untouched) while Monthly Expense's filter scopes the whole month view (total/count/rows), since it has no budget concept to protect | 25 |
| `test-regression.js` | Diffs a **baseline snapshot** against the current file: rendered markup of all 5 tabs, 45 derived money values, post-boot `state`, and console errors | 15 |

`test-regression.js` needs a pre-change snapshot:

```bash
git show <ref>:"Sparta Finance Tracker/Sparta ap stock tracker.html" > tests/baseline.html
```

Without one, `run-all.sh` skips it and runs the other two.

## Benchmarks

```bash
node bench.js "../Sparta ap stock tracker.html" 7   # single build
node ab.js 9                                        # interleaved A/B vs baseline.html
```

External hosts (Google Fonts, frankfurter, finnhub) are stubbed with fixed
latency so runs are deterministic. Chromium throttles rAF in headless, so
frame-gap numbers are not meaningful here — the reliable signals are load
timings, running-animation count, idle layout count, and request/error counts.

## Notes

- `FIREBASE_ENABLED` is `false` in the committed file, so no suite touches the cloud.
- Fixtures seed `localStorage` once per context; `lib.js` guards against the
  re-seed that would otherwise wipe state on reload.
- Contribution fixtures set `cad:true` + `sparta.contrib.cadFixed` so the legacy
  CAD migration does not silently multiply them by the FX rate. That migration is
  exercised on purpose in `test-data.js`.
