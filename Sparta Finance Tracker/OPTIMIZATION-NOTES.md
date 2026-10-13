# Optimisation pass — `build 2026-07-26p` → `build 2026-08-14a`

Single-file constraint kept: no split, no reformat, no rewrite of working CSS or
JS logic. Every change is either a loading-strategy fix, an animation-scheduling
fix, or the deletion of code with zero reachable references.

## Results

Interleaved A/B, 9 rounds per arm, medians (IQR in brackets). External hosts
stubbed with fixed latency so both arms see the same network.

| Metric | Before | After | Change |
|---|---|---|---|
| Wall-clock load | 437 ms [417–458] | **188 ms** [186–196] | **−57 %** |
| DOMContentLoaded | 337.8 ms [336.6–395.6] | **166.6 ms** [163.5–180.7] | **−50.7 %** |
| `load` event | 432.8 ms [413.7–453.7] | **183.4 ms** [182.9–190.7] | **−57.6 %** |
| Running CSS animations | 100 | **42** | **−58 %** |
| Layouts during 3 s idle | 33 [30–33] | **1** [1–1] | **−97 %** |
| Failed network requests | 1–2 | **0** | −100 % |
| Console errors | 3–5 | **2** | −33 % |
| File size | 259 256 B | 257 244 B | −0.8 % |
| Switch all 5 tabs | 64.9 ms | 70 ms | **+7.9 %** (see trade-off) |

The two remaining console errors are 404s for `SpAPP.png`, which simply isn't in
the repo — drop the logo beside the HTML and they go away.

## What changed

### 1. Fonts were blocking first paint — the single biggest win

`<link rel="stylesheet">` to `fonts.googleapis.com` is render-blocking: nothing
paints until that round-trip completes. There was also no `preconnect` to
`fonts.gstatic.com`, where the actual font files live, so that connection was
only opened after the CSS parsed.

- added `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
- loaded the font CSS non-blocking via `media="print"` + `onload="this.media='all'"`,
  with a `<noscript>` fallback

The stylesheet already used `display=swap`, so a fallback-font flash was always
part of the design; this only makes the fallback appear sooner. Accounts for
essentially all of the load-time improvement.

### 2. ~55 invisible animations were running on every frame — the runtime win

All five backdrop fields (`.tickerfield`, `.cashfield`, `.financefield`,
`.monthlyfield`, `.archivefield`) live in the DOM permanently and are hidden with
`opacity:0` so they can cross-fade. **`opacity:0` does not stop a CSS animation.**
100 elements were being ticked continuously; only ~42 were ever visible.

```css
.tk,.cu,.fin,.mo,.arc,.tkchart,.tkcandle,.curing,.cubar{animation-play-state:paused}
body.dash-view .tk, … body.monthly-view .mo{animation-play-state:running}
```

Spec-guaranteed, and invisible to the user because the paused elements are fully
transparent. `prefers-reduced-motion` rules still win — they use `!important`.

**Trade-off, measured and kept deliberately:** toggling a body class now
re-evaluates `animation-play-state` on ~100 elements, costing ~2 ms per tab
switch (isolated by benchmarking a variant with only these rules removed: 62 ms
vs 71.9 ms for five switches). That buys 58 fewer animations ticking continuously
and 97 % fewer idle layouts. A one-off 2 ms on a user-initiated action in
exchange for permanently lower background cost — worth it, especially on battery.

A first attempt used `.tickerfield *`, which matched every SVG descendant and
cost ~12 %; narrowing to the nine animated classes cut that to ~8 %.

### 3. A hardcoded Windows path failed on every load

```css
background-image: url('SpAPP.png'), url('file:///C:/Users/abhi.patel/Downloads/SpAPP.png');
```

Present twice (`.brand .orb`, `.pin-orb`). Browsers **block** a `file://`
subresource whenever the page is served over `http(s)` — so on Netlify, GitHub
Pages, or any local server this was a guaranteed failed request plus a console
error, every load. The relative `url('SpAPP.png')` is kept and unchanged.

> ⚠️ **Behaviour change to be aware of:** if you open the HTML directly as
> `file://` on the machine where that path exists, the logo previously resolved
> from `Downloads`. It now only resolves from `SpAPP.png` next to the HTML.
> Copying the PNG beside the file restores it everywhere — including in this
> repo, where committing `SpAPP.png` into this folder would also clear the two
> remaining 404s.

### 4. Dead code removed

JS — each of these appeared exactly once in the whole file, on its own
declaration line, with zero call sites in markup, CSS or script:

| Removed | Why it was dead |
|---|---|
| `syncPayload()` | superseded by `corePayload()` when sync moved to the core + per-day-history shape (ref doc §4) |
| `exportHoldingsCSV()` | 16-line CSV export never wired to any button |
| `lifetimeFhsaCad()` | FHSA lifetime total; the UI computes it inline |
| `loggedYears()` | superseded by `yearOptions()` |
| `baseToNat()` | inverse of `natToBase()`; only `natToBase()` is called |
| `const MONTHS` | superseded by `YF_MONTHS` |

CSS — rolled-back design leftovers with no matching markup:
`.yf-avg` + `.arow` block (6 rules), `.yf-balbars`/`.yf-bal`, `.yf-mini` block
(3 rules), `.skeu-plate`, `.yf-six`, the commented-out predecessor of
`.brand .orb`, and the unused `--arc2` custom property.

Two latent defects fixed while here:

- `#impCard .note{margin-top:12px}` targeted an id that does not exist — the
  element is `id="importCard"`. The rule had never applied, so it was deleted
  rather than repointed (repointing would have been a visual change).
- A stray surplus `}` after the PIN media queries. Browsers recovered from it,
  but the stylesheet was malformed.

## Deliberately *not* changed

- **16 unreferenced `id` attributes** (`backdrop`, `verStamp`, `tickerField`,
  `impNote`, …). They cost ~250 bytes total, 0.1 % of the file, and carry zero
  runtime cost. Removing them risks breaking a reference the scan missed, for no
  measurable gain.
- **The `.htable th.sortable.on.asc` rule.** It looks like a sort-direction
  toggle that was never finished, but `.asc` *is* applied (line ~2379) — the
  design is two sort **modes**, not a direction toggle: `sortBy='sym'` is always
  A→Z, `sortBy='pl'` is always highest-first. Clicking the same header twice is a
  no-op by design. Not dead, not a bug.
- Anything under `prefers-reduced-motion` — those `!important` rules still take
  precedence over the new play-state rules, as intended.

## Verification

87 automated checks, all passing — see `tests/README.md`.

The strongest evidence that nothing broke is `tests/test-regression.js`: it loads
the pre-change and post-change files side by side with identical seeded state and
asserts that the rendered markup of **all five tabs**, **45 derived money
values**, and the **post-boot `state` object** are byte-identical. They are.

Per ref-doc §9 the default is not to run sweeps like this; it was done here
because the change touched shared CSS and deleted code.
