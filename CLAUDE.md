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

## The lighting model

A casino room is dark with bright sources in it. Build every screen that way:

- A **dark ground** with light pooled where the action is, never flat fill.
- A **halo** — a slow conic sweep behind the live session banner, like light
  turning over a table. 26s, linear, infinite.
- A **lamp** — a soft radial glow above the fold, breathing at ~6s.
- **Marquee bulbs** along the top edge of the hero, chasing at ~1.5s with
  staggered delays so they never blink in unison.
- **Glow** belongs to the accent only. Text shadow on the wordmark, box shadow
  on the primary action. Never on body copy or score tables.

## Motion vocabulary

Named animations, reused everywhere. Do not invent a seventh without reason.

| Name | What it does | Where |
| --- | --- | --- |
| `dcRise` | fade + 20px lift | tiles, banner, panels entering |
| `dcDeal` | fade + lift + slight rotate, like a card landing | card-shaped tiles |
| `dcDot` | scale + fade pulse, 1.6s | the LIVE indicator |
| `dcSweep` | a light bar crossing left to right, 3.6s | primary action button |
| `dcSpin` | 26s rotation | the halo behind the hero |
| `dcBulb` | opacity + glow blink, 1.5s | marquee bulbs |
| `dcFlicker` | irregular neon stutter, 7s steps | wordmark, neon direction only |

Rules:

- Entrances **stagger** — 0.06s, 0.14s, 0.22s, 0.30s across the four tiles.
- Easing is `cubic-bezier(0.2, 0.7, 0.3, 1)` for entrances, `ease` for hovers.
- Hover on a tile **lifts it like a chip**: `translateY(-7px)` plus a deeper
  shadow and a brightened border, 0.28s.
- Rows highlight on hover with a 9%-alpha accent wash, 0.2s.
- Ambient loops (halo, bulbs, lamp) run forever. Entrance animations run once.
- **Respect `prefers-reduced-motion`**: keep colour, lighting and glow, drop the
  loops and entrance transforms.

## Palette rules

- Dark ground, one metallic or neon accent, one alert red for live state.
- Accents share chroma and lightness and vary only in hue.
- Whites and blacks are tinted toward the room, never pure `#fff` / `#000`.
- Score numerals get the accent; labels stay muted. Never colour a whole table.

## Typography

- A **display face** for game names, scores and the wordmark, paired with a
  clean body face. Numerals may be a third, monospaced face.
- Banned: Inter, Roboto, Arial, Fraunces.
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

Six home-page directions are drafted and published as a design canvas. Working
sources live in `design/home-directions/`.

| File | Direction |
| --- | --- |
| `Main.dc.html` | A · Felt & Gold — felt green, gold foil, serif display |
| `NeonNoir.dc.html` | B · Neon Noir — midnight blue + magenta, neon flicker |
| `HighRoller.dc.html` | C · High Roller — black + signal red, oversized type |
| `DecoBrass.dc.html` | D · Deco Brass — art-deco symmetry, brass linework |
| `SuitMotif.dc.html` | E · Suit Motif — tiles are the four suits, light theme |
| `MinimalTable.dc.html` | F · Velvet Minimal — velvet plum + champagne, restrained |

**Active direction: not yet chosen.** Once picked, record it here and build the
real palette tokens from that artboard.

## Sample data used in mockups

Players Abhi, Priya, Rahul, Nikhil, Sneha. Games Rummy, Judgement, Bluff — all
placeholders until the real house games are named.
