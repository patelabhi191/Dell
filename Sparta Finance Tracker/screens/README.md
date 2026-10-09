# screens/ — what the design review looked at

Everything here was captured from the app as it stands on this branch, with a
Playwright harness that freezes transitions and animations first. Nothing in
the app was edited to produce any of it.

Transitions are frozen because `getComputedStyle` returns the CURRENT
interpolated value of a property still in transition — reading a tab button a
few milliseconds after a click catches `.seg button.active` as dark ink over a
background that has not finished becoming white, which measures 1.22:1 and is a
measurement of nothing. The same trap made an early reading of the account
chips wrong by 0.2 and nearly bought a colour change that was not needed.

## tabs/
All six tabs at 1440 (desktop) and 375 (phone), full page. Archives is captured
with its first card expanded and Plan with a seeded segment, so neither is an
empty tab.

## surfaces/
The three things that are not a tab:

| file | what |
|---|---|
| `drawer-1440.png` | Settings drawer open. Content height 656px against the documented ≤660 cap. |
| `modal-sell-1440.png` | The sell dialog, 400×384, fully inside the viewport. |
| `pin-1440.png` | The PIN gate. |

## print/
`yearly-as-printed.png` — Yearly Finance as Chrome actually prints it. The app
has **no `@media print` rules at all** (0 of 887 rules), and Chrome's
"Background graphics" checkbox is off by default, so every background is
dropped and every text colour is kept. `--text` #EAF0FA measures **1.14:1
against white paper**, `--text-faint` 1.08:1, `--text-dim` 1.10:1. The
decorative `aria-hidden` artwork prints more strongly than the data does.

## Not here
The before/after pair for the two ink tokens is not a screenshot folder — it is
`../preview-contrast-tokens.html`, which carries both states of eight separate
roles plus two whole tabs, each with its measured ratio printed underneath.
