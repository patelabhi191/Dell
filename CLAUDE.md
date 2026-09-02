# Card Night — score tracking site

## What this project is

A site that keeps the record of the card games we play in person: past results,
all-time standings, and the running scores of a game currently in progress.

**It is a score-tracking site, not a game-playing site.** Nothing here deals or
plays cards. Every screen exists to enter scores, read standings, or look up
history.

## Settled decisions

| Decision | Choice |
| --- | --- |
| Structure | **Single page** app, not one HTML page per game |
| Games | **Fixed**: 1 · 3 of Spade · 2 · KaChuFull · 3 · More Coming Soon · 4 · Archives |
| Scoring | Highest total wins; round-by-round entry with running totals |
| Backend | **Firebase Firestore**, live updates so every phone sees the same scores |
| Access | Anyone with the link — no login |
| Site name | **TBA** — use a placeholder wordmark until it is chosen |
| Entry device | A phone, at the table, mid-game. Mobile-first is not optional |

Home page priority order: live session banner → 4 tiles → all-time leaderboard →
recent results.

---

# THEME: Casino. This is permanent.

**Everything in this project is inspired by casinos.** This is not a coat of
paint on one page — it governs colour, lighting, type, motion, transitions,
sound of the copy, and every component built from here on. Apply it without
being asked, on every screen, every new feature, every fix. If a change would
make the site look more like a generic dashboard, it is wrong.

## The register: playful, not luxury

**Bright, colourful, high-energy — the casino floor, not the private salon.**
This is the single most important line in this file. Aim at what is common and
trending at casinos and casino apps: saturated colour, glossy chips, marquee
bulbs, jackpot celebration, chunky rounded type. Do **not** aim at gold-foil,
felt-and-serif restraint. If a screen reads expensive and hushed, it is wrong.

## The lighting model

A casino floor is **lit up**, not dim. Build every screen that way:

- **Bright grounds are the default** — cream, sunny yellow, turquoise, red.
  A deep ground is allowed only when the direction is genuinely neon, and then it
  must carry saturated colour, not muted metal.
- **Marquee bulbs** along the edge of the hero, chasing at ~1.5s with staggered
  delays so they never blink in unison.
- **Confetti** drifting behind the live session banner — the room celebrates.
- **Glossy highlights** on chips and buttons: inset light from above, a solid
  drop shadow below. Depth comes from hard offset shadows or fat soft ones,
  never from a decorative gradient wash.
- **Sweep** a light bar across the primary action so it never sits still.

## Motion vocabulary

Named animations, reused everywhere. Do not invent a new one without reason.

| Name | What it does | Where |
| --- | --- | --- |
| `dcPop` | scale overshoot entrance, bouncy | tiles, chips, badges, banner |
| `dcJiggle` | small rotate wobble | tile suit icon on hover |
| `dcDot` | scale + fade pulse, 1.5s | the LIVE indicator |
| `dcSweep` | a light bar crossing left to right, 3.2s | primary action button |
| `dcBulb` | opacity + glow blink, 1.5s | marquee bulbs |
| `dcConfetti` | pieces drifting down, 4.6s | live session banner |
| `dcTwinkle` | staggered sparkle stars, 2.2s | around the wordmark |
| `dcCoin` | coin flip | win badges |
| `dcReel` | slot-reel settle on a numeral | the leader's live score |

Rules:

- Entrances **stagger** — 0.06s, 0.14s, 0.22s, 0.30s across the four tiles.
- Easing has **overshoot**: `cubic-bezier(0.34, 1.56, 0.64, 1)` for entrances and
  hovers. A linear glide reads corporate; the bounce is the point.
- Hover on a tile **lifts it like a chip**: `translateY(-8px)` plus a deeper
  shadow, 0.24s, and the suit icon jiggles.
- Rows highlight on hover with an accent wash and a 3px nudge right.
- Ambient loops (bulbs, confetti, twinkle, sweep) run forever. Entrances run once.
- **Respect `prefers-reduced-motion`**: keep every colour and every light, drop
  all animation and transition.

## Palette rules

- A **multi-hue chip palette of 4-6 saturated colours** — red, teal, blue,
  yellow, pink, lime. Not one metallic accent on a dark ground.
- **Each game tile owns a colour.** The four tiles are four different colours;
  that colour identifies the game everywhere else it appears.
- Grounds may be cream, saturated, or deep-vivid. Never grey.
- One clear alert colour for live state, distinct from the game colours.
- Whites and blacks are tinted warm, never pure `#fff` / `#000`.
- Score numerals get the display face and full contrast; labels stay muted.
  Never colour a whole table.

## Typography

- A **chunky display face** for game names, scores and the wordmark, paired with
  a clean rounded body face. Proven pairings: Bungee + Rubik, Baloo 2 + Nunito,
  Titan One + Mulish, Fredoka + Quicksand, Alfa Slab One + DM Sans,
  Monoton + Outfit.
- Banned: Inter, Roboto, Arial, Fraunces. Thin weights and high-contrast serifs
  are wrong for this register.
- Scores are the largest type on any screen after the game name.

## Theming: all four skins ship

The four skins are **not** alternatives to choose between — all four ship, and the
active one is set from Admin.

- **83 CSS custom properties**, defined four times over as `[data-theme="terminal"]`,
  `"slot"`, `"neon"`, `"tropical"`. Every colour, border, radius and shadow in the
  app resolves through a `var(--token)`; no themed literal survives in markup.
- Switching sets **one attribute on the root**. A 240ms transition on background,
  colour, border and shadow carries the change so it reads as a re-skin, not a flash.
- Four things are **structural, not colour**, and are rules keyed on the theme
  attribute rather than tokens: plaque shape, ambient effect (confetti on Slot,
  flicker on Neon, felt shimmer on Tropical, none on Terminal), shadow language
  (hard offset / soft / glow) and corner-radius language.
- The token table lives in one place — `design/admin-theming/tokens.mjs` — so the
  skins cannot drift apart. Any new token must be added to **all four** themes.
- `--acc3` is deliberately unused today: it is reserved for the third game when
  **More Coming Soon** becomes real.

### The setting

`settings/site` in Firestore: `{ theme: 'terminal' | 'slot' | 'neon' | 'tropical' }`.
One global setting for the whole group, read with `onSnapshot` so a change reaches
every open phone without a reload. Falls back to `terminal` when the document is
missing or unreadable.

### Admin access

Admin is gated by a **4-digit PIN**. Be honest about what that is: a PIN checked
in the browser is a **deterrent, not a security boundary** — anyone can read it in
the page source. It stops accidental and casual changes, which is its job here.

This is proportionate rather than sloppy: the site is already open to anyone with
the link for entering and editing scores, so the theme setting is a lower-value
target than the data itself. If real enforcement is ever wanted, the upgrade path
is Firebase Anonymous Auth plus a Cloud Function that validates the PIN and sets
an `admin` custom claim, with Firestore rules requiring it — that needs the Blaze
plan. Do not describe the PIN as securing anything.

## Layout: the casino terminal

The house layout is taken from a physical casino terminal (Interblock G4), not
from a web dashboard. Every screen that lists things follows it:

- **Centred plaque header.** The wordmark sits in a plaque — hexagon, trapezoid,
  arch, pill or marquee — centred on a hairline rule that runs the full width and
  passes behind it. A small mark sits at the far right where an operator logo
  would go.
- **One row of portrait tiles.** Games are ~3:4 portrait tiles in a single row,
  never a squat grid of cards. Each tile is a framed **art panel** with the game
  name in a solid **footer band** across its foot. The art is the game itself —
  fanned cards, a chip stack, a felt table — drawn in CSS and inline SVG.
- **Tap prompt and carousel dots** under the row. The dots say more games can be
  added without redesigning anything.
- **The live session bar sits at the TOP**, directly under the plaque and above
  the tile row: live indicator, game and round, every player's running score,
  target, and the Resume button. Resuming is always one tap away.
- Standings and recent results sit at the foot, below the tile row and prompt.

That bar is the load-bearing idea. Scores get entered on a phone mid-game, so the
thing that must never be more than one tap away is the game in progress.

## The games and their logos

| # | Game | Logo |
| --- | --- | --- |
| 1 | **3 of Spade** | The numeral **3** beside a solid black **spade**, on three fanned cards |
| 2 | **KaChuFull** | A **diagonal saltire cross** carrying all four suits on its arms, hub monogram at the centre |
| 3 | **More Coming Soon** | An intentional **ghost tile** — dashed frame, muted panel, plus mark. It reads as a slot waiting to be filled, never as a broken tile |
| 4 | **Archives** | Box-and-papers, inverted band, visually distinct from the game tiles |

Both game logos are redrawn per skin so each one belongs to its own palette —
never one flat mark pasted across every theme.

## Iconography

- Suits (♠ ♥ ♦ ♣) are the icon system, drawn as **inline SVG paths** on a 24px
  grid. Trophy, archive box and play triangle in the same stroke style.
- **Never use emoji as icons.**

## Hard nos

- No flat grey dashboard panels, no generic card-with-left-border-accent.
- No gradient wash used as decoration rather than lighting.
- No animation on score *values* that delays reading them.
- Legibility beats atmosphere: glow never lands behind dense score tables.

---

## The app

`AP-CardGames.html` at the repo root is the working site: one self-contained file, no
build step, no dependencies. Open it directly or serve it anywhere static.

- Storage is `LocalStore` (this device's `localStorage`) by default.
  `FirestoreStore` implements the same interface and takes over as soon as
  `FIREBASE_CONFIG` is filled in at the top of the file. **Shared live sync is
  not active until those keys exist** — until then every device keeps its own copy.
- Routes: `#/` home, `#/new`, `#/session/<id>`, `#/archives`, `#/players`, `#/admin`.
- The 86 theme tokens are generated from `design/admin-theming/tokens.mjs`; never
  hand-edit them in `AP-CardGames.html`, edit the table and re-inject.
- Text that sits on the page ground (not on a panel) must use `--ground-ink` /
  `--ground-muted` on a `--ground-plate`. `--muted` is tuned for panels and is
  unreadable on a saturated ground — this is why the plate exists.

## Design directions (superseded by the app)

The live set is `design/home-final/` — four skins of the terminal layout,
carrying the real games and the presentation motion:

| File | Skin |
| --- | --- |
| `Main.dc.html` | A · Terminal Classic — charcoal, trapezoid plaque, condensed caps |
| `SlotTerminal.dc.html` | B · Slot Machine — red carnival, marquee bulbs, confetti |
| `NeonTerminal.dc.html` | C · Neon Terminal — indigo, flickering neon tube plaque |
| `TropicalTerminal.dc.html` | D · Tropical Table — turquoise felt, arched plaque, coral |

Superseded, kept only as a record — do not build from any of them:
`design/home-directions/` (round one, too dark and too luxury),
`design/home-directions-v2/` (round two, bright but on the dashboard layout),
`design/home-terminal/` (round three, terminal layout with placeholder games).

**Active direction: not yet chosen.** Once picked, record it here and build the
real palette tokens from that artboard.

## Sample data used in mockups

Players Abhi, Priya, Rahul, Nikhil, Sneha are placeholder names. The games are
real and fixed (see above); the live session shown is 3 of Spade, round 7,
first to 500.
