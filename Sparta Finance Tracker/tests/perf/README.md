# Performance probes — NOT part of the suite

These are measurement scripts, not tests. They assert nothing and `run-all.sh`
does not run them, deliberately: a timing threshold on shared CI hardware is a
test that fails for reasons unrelated to the code, and this project's policy is
unit tests only.

Run one directly when you want numbers:

    cd "Sparta Finance Tracker/tests" && node perf/profile-boot.js

| file | what it measures |
|---|---|
| `fixture-5-years.js` | the shared fixture: 3,441 ledger rows, 4,000 history points, 260 contributions, 5 archives, 150 Plan items, ~1 MB of seed. Deterministic (seeded LCG, no `Math.random`), so runs are comparable. |
| `profile-boot.js` | cold boot over 5 fresh contexts, then the cost of each normaliser, render and `snapshot()`/`persist()` |
| `profile-latency.js` | `compactHistory` on genuinely raw points, typing, tab switches — **and the measurement floor** |
| `profile-scaling.js` | the storage footprint split by drawer, and the same functions at 860 / 1,720 / 3,441 / 6,882 rows |
| `profile-ledger-scans.js` | counts how many times one `renderYF()` re-filters the whole ledger |

## Read `profile-latency.js`'s floor before believing any latency figure

A bare `requestAnimationFrame` doing nothing costs **~134 ms** in the cloud
sandbox — about 7 fps idle. Every per-keystroke measurement includes one, so the
app's contribution is below the noise. An earlier pass reported "126 ms per
keystroke" that was entirely the harness, and on a surface (`#npStockInput`)
that has no `input` listener at all. The floor control is in the script for that
reason: measure a frame of nothing, and subtract it, or do not report the number.

Two more traps these scripts already avoid, both of which produced a wrong
number first:

- **`compactHistory` must be given genuinely raw points.** Resetting
  `state.history` to a copy taken *after* boot measures a no-op, because boot has
  already folded 4,000 points to 92. The raw array is injected from the fixture.
- **Measure the handler, not the handler plus two frames**, when you want to know
  what the app costs. The frame wait is what the user feels, but at a 134 ms floor
  it tells you nothing about the code.

Results as of 2026-10-17 are written up in `Sparta_FIN_AP.md` section 9a.
