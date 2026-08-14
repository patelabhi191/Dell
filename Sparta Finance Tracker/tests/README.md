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
| `test-contrib.js` | Contributor (Abi/Poo) tracking: `depositContrib` defaults to Abi, migration on both branches (already-tagged entries untouched, untagged entries backfilled), the yearly-backfill zero-amount guard now split per contributor/account, the old-shape `{tfsa,fhsa}` yearly-draft fallback, stacked-chart segment totals vs. `contributed()`, and the All/Abi/Poo filter — confirms it scopes the chart + deposit log but leaves the TFSA/FHSA hero cards and room-remaining untouched | 28 |
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
