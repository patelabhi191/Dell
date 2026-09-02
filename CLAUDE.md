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
| Games | 3 custom house games + a 4th **Archives** tile = 4 tiles on screen |
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

## Design directions (decision pending)

Two rounds of home-page directions are drafted and published as design canvases.
Round one (dark/luxury, rejected as "all look dark") lives in
`design/home-directions/`. Round two — bright and playful, the live set — lives in
`design/home-directions-v2/`.

Round two — `design/home-directions-v2/`, the live set:

| File | Direction |
| --- | --- |
| `Main.dc.html` | 1 · Jackpot Pop — sunny yellow, cherry red + teal, bulbs, confetti |
| `CandyChips.dc.html` | 2 · Candy Chips — cream, glossy chip discs as the tiles |
| `SlotMachine.dc.html` | 3 · Slot Machine — red/white/blue, reel-window tiles |
| `RetroVegas.dc.html` | 4 · Retro Vegas — 60s motel signage, arched tiles, starbursts |
| `TropicalTable.dc.html` | 5 · Tropical Table — turquoise felt, coral, sunshine yellow |
| `NeonArcade.dc.html` | 6 · Neon Arcade — indigo with pink/cyan/lime neon (the one dark one) |

Round one — `design/home-directions/`, superseded: Felt & Gold, Neon Noir,
High Roller, Deco Brass, Suit Motif, Velvet Minimal. Kept only as a record of
what "too dark" looked like; do not build from these.

**Active direction: not yet chosen.** Once picked, record it here and build the
real palette tokens from that artboard.

## Sample data used in mockups

Players Abhi, Priya, Rahul, Nikhil, Sneha. Games Rummy, Judgement, Bluff — all
placeholders until the real house games are named.
