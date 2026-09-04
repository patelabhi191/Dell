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
| Games | **Fixed**: 1 · 3 of Spade · 2 · KaChuFull · 3 · More Coming Soon · 4 · Archives + Players |
| Scoring | Highest total wins; round-by-round entry with running totals |
| Backend | **Firebase Firestore**, live updates so every phone sees the same scores |
| Access | Anyone with the link — no login |
| Site name | **AP Card Games Night** — wordmark `AP CARD GAMES`, plaque sub `Night` |
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
- **Marquee bulbs** along the edge of the hero, chasing at ~2.6s with staggered
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
| `dcRise` | fade up, one-shot | desk head, rail, console, ledger, sheet |
| `dcDeal` | drops in rotated, like a dealt card | a round landing in the ledger |
| `dcFlip` | card turns on its Y axis | a called card being revealed |
| `dcStamp` | slams down oversized, settles | the win/loss verdict on a round |
| `dcDelta` | a `+N` chip floats up and fades | each player's gain during the reveal |
| `dcCrownIn` | crown drops on, overshoots | the new leader after a swap |
| `dcShock` | ring pulses outward, twice | behind the newly crowned leader |
| `dcThrone` | scale bounce | the pod taking first place |
| `dcBurst` | confetti flung radially | a change of leader |

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

## Theming: all eight skins ship

The skins are **not** alternatives to choose between — all eight ship, and the
active one is set from Admin.

| id | skin | register |
| --- | --- | --- |
| `terminal` | Terminal Classic | charcoal chrome, trapezoid plaque |
| `slot` | Slot Machine | red carnival — deliberately the loudest, but toned down |
| `neon` | Neon Terminal | indigo, flickering tube |
| `tropical` | Tropical Table | turquoise felt, arched plaque |
| `glassdark` | Frosted Dark | iOS glass over a night wallpaper |
| `glasslight` | Frosted Light | iOS glass over a bright wallpaper |
| `midnight` | Midnight Studio | black ground, electric editorial accents |
| `daylight` | Daylight Studio | warm white, the same accents |

**The frosted pair is the one exception to the casino register** — it exists so
the site can read as an ordinary, well-built iOS app when that is wanted. Four
things make it read as glass rather than as frosted plastic, and none of them is
the blur radius:

1. **Grain.** Each surface token is three layers — a monochrome `feTurbulence`
   data-URI, a specular top-to-bottom gradient, then the translucent fill. Every
   surface paints through the `background:` shorthand, so this rides inside
   `--panel`, `--strip-bg`, `--tile-bg`, `--plaque-bg` and `--ground-plate` with
   no structural change. It is the single biggest tell.
2. **Refraction lives on the edges.** The shadow tokens carry a bright 1px inset
   line along the top where light enters the curve, a dim one at the foot, an
   inner glow falling off toward the middle, then a tight contact shadow and a
   wide ambient one. That is what gives a pane thickness.
3. **Material tiers.** Nav chrome takes `blur(30px) saturate(190%)` with a
   `brightness()` term; content cards take `blur(22px) saturate(175%)`. The
   difference between tiers is most of what reads as depth.
4. **A ground worth blurring.** Frosted Dark is two colours merging — crimson
   flowing into deep indigo across the diagonal, with a top light and a foot
   vignette. Frosted Light carries no blobs at all: a light field merging to a
   second shade over its last quarter, grey deepening at the left and right
   edges, and three static wave bands (an inline SVG, stretched by a
   theme-scoped `background-size`) so it reads as slow water rather than paper.

Colour is deliberately restrained: tiles are neutral glass with the game's colour
surviving as a tint and a thin edge, so the wallpaper and the current selection
are the only saturated things on screen. The blur is applied to the **chrome
only** — never to `.pod`, `.pick` or `.lrow`. Dozens of blurred layers per screen
is what makes glassmorphism crawl on a phone, and a row on an already-frosted
panel gains nothing.

**Midnight and Daylight are one palette on two grounds**, not two unrelated
skins — violet, mint, sky and coral, flat blocks, offset shadows, Space Grotesk
over Outfit.

`--acc1` is tuned to be vivid as a **fill**. Used as text it fell as low as
2.44:1, so `--acc1-text` is its sibling tuned for type — the leader's score, the
scoresheet total, the card number, links. Never colour text with `--acc1`.

- **90 CSS custom properties**, defined eight times over — `terminal`, `slot`,
  `neon`, `tropical`, `glassdark`, `glasslight`, `midnight`, `daylight`. Every
  colour, border, radius and shadow in the app resolves through a `var(--token)`;
  no themed literal survives in markup.
- Switching sets **one attribute on the root**. A 240ms transition on background,
  colour, border and shadow carries the change so it reads as a re-skin, not a flash.
- Four things are **structural, not colour**, and are rules keyed on the theme
  attribute rather than tokens: plaque shape, ambient effect (confetti on Slot,
  flicker on Neon, felt shimmer on Tropical, none on Terminal), shadow language
  (hard offset / soft / glow) and corner-radius language.
- The token table lives in one place — `design/admin-theming/tokens.mjs` — so the
  skins cannot drift apart. Any new token must be added to **all eight** themes,
  and `scratchpad/themecheck.mjs` asserts that parity.
- `--acc3` is deliberately unused today: it is reserved for the third game when
  **More Coming Soon** becomes real.

### The setting

`settings/site` in Firestore: `{ theme: 'terminal' | 'slot' | 'neon' | 'tropical' |
'glassdark' | 'glasslight' | 'midnight' | 'daylight' }`.
One global setting for the whole group, read with `onSnapshot` so a change reaches
every open phone without a reload. Falls back to `terminal` when the document is
missing or unreadable.

### Admin, one page in three sections

No tabs — you scroll it, in the order you'd work down it: **1 Database**,
**2 Settings**, **3 Appearance**. The skins come last because they are the
thing you change least.

**The Firestore connection is configured in `FIREBASE_CONFIG` at the top of
`AP-CardGames.html`, and nowhere else.** Admin cannot edit it — the connection
belongs to whoever deploys the file, not to whoever opens it in a browser. The
Database section is read-only: connection name, project id, the document path,
the REST endpoint, the SDK url, and which store is actually live. Its one
control is **Test connection**, which writes a scratch document to
`cardnight/_conntest`, reads it back and deletes it, reporting either the round
trip or the exact failure code.

**Settings** holds switches that are stored but not yet wired: `pinScores` (PIN
before a round can be saved) and one reserved slot. A switch is deliberately
allowed to exist before the behaviour behind it does, so turning it on survives
a reload and the feature can be attached later without another Admin change.

The Firebase SDK is **not** bundled. It is pulled from Google's CDN by dynamic
`import()` the first time a connection is attempted, so an unconfigured copy of
the app loads nothing extra and still runs offline on `localStorage`. The board
stays usable on local storage while the connection is proving out; only once
`FirestoreStore.init()` resolves does `Store` get promoted, so a failed
connection leaves the app exactly where it was.

The config values are ordinary client keys — they ship to every visitor by
design. **Firestore security rules are what protect the data, never the secrecy
of these values.**

### Admin access

Admin is gated by a **PIN**. Be honest about what that is: a PIN checked in the
browser is a **deterrent, not a security boundary** — anyone can read it in the
page source, or in the settings document once it lives there. It stops accidental
and casual changes, which is its job here.

The pad gives nothing away: no length hint, no pre-drawn slots, one dot appearing
per character typed, up to 8. Keys run 1-9, then **A B C**, then CLR / 0 / OK, so
the PIN is not limited to digits. `adminPin()` reads `settings.pin` and falls back
to the constant, which is where the Firestore-held PIN will arrive; it is **2468**
until then.

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
  and the Resume button. Resuming is always one tap away.
- **More than one table can be running.** One live session shows as a single
  bar. Two show as two. Beyond that a count chip reads *"N tables running"*, the
  two newest stay on screen and the rest fold behind **Show all N**. A game tile
  whose game has several tables running says `2 LIVE` rather than `LIVE`.
- Standings and recent results sit at the foot, below the tile row and prompt.
- **No bottom nav.** Admin is the plaque's operator mark, top right. Archives
  and Players are the two halves of slot four, and each page carries a tab strip
  so you can cross between them without going home.

That bar is the load-bearing idea. Scores get entered on a phone mid-game, so the
thing that must never be more than one tap away is the game in progress.

## Inside a game: the desk

A session screen is a **desk**, not a document. It runs on the wide shell
(`.wrap.wide`, 1520px) because the console needs the room:

- **Desk head** — game name and the session's facts as chips (live, rounds,
  players, decks and cap, partners), Finish at the far right.
- **Left rail, sticky: the podium.** One pod per player, ranked, big numeral,
  the leader outlined in `--acc1`. This is also the stage the reveal plays on —
  every animated element is keyed by player id so it survives a re-render.
- **Main column: the console, then the ledger, then the scoresheet.**

### The console is always open

There is no "Add round" button to press first. The console for the next round is
on screen the moment the session loads, and when a round is waiting on its
reveal the same console flips to the reveal instead. Numbered steps run down the
left; the step number turns green as each is answered.

**One tap, one value — never a dropdown.** Bidder, sir, rank and suit are all
chips. The bidder and sir rows are `.rack` grids that end exactly where the card
racks end — the callrow reserves 74px for the card face plus a 12px gap, so the
rack carries `padding-right: 86px` and every row shares one right edge. The
bidder rack sizes its type to the roster (18 / 16 / 14 / 12.5px at 4 / 6 / 8 /
more players) so every name stays on one line, whole and unclipped; below 860px
it gives up on aligning and wraps instead. Ranks are a 13-wide grid rack that regrids to 7 then 5 columns as the
screen narrows, so a wrapped last row keeps its column width. The four suits
span that same full width beneath it — glyph plus name, edged in `--suit-edge`
so they read as cards rather than buttons — regridding to 2x2 on a phone. Each
card's number is a highlighted `--acc1` plaque, and a card-face preview of the
chosen card closes the row. The bid takes quick chips scaled to the deck cap,
a ±5 stepper, and a number field set apart from them.

The draft round lives in memory (`draft`), not in storage, so a tap repaints
chips in place (`paintConsole`) instead of re-rendering and throwing away focus,
scroll and animation. Duplicate called cards are resolved in the model — suit
first, then rank, since five pickers cannot fit in one rank's four suits.

### The reveal is the point of the screen

Tapping a winner changes the board and may change who is winning, so it is
staged rather than swapped silently (`playReveal`):

1. The verdict **stamps** onto the round and its called cards **flip**.
2. Every score **counts up** from its old total, with a `+N` floating off each pod.
3. The podium **re-orders itself** — FLIP, measured before the re-render and
   released after, so rows travel rather than jump; the movers lift and shadow.
4. If the lead changed hands, the new leader is **crowned**, ringed by a
   shockwave, and given a confetti burst.

The board is locked while it plays and a tap anywhere fast-forwards to the end
state. Under `prefers-reduced-motion` the sequence is skipped outright — the
scores just land.

## The games and their logos

| # | Game | Logo |
| --- | --- | --- |
| 1 | **3 of Spade** | *Being redrawn.* The tile shows its frame and band only |
| 2 | **KaChuFull** | *Being redrawn.* The tile shows its frame and band only |
| 3 | **More Coming Soon** | An intentional **ghost tile** — dashed frame, muted panel, plus mark. It reads as a slot waiting to be filled, never as a broken tile |
| 4 | **Archives + Players** | Split in half: box-and-papers over a stack of chips, a band each. Two destinations in one frame, visually distinct from the game tiles |

**3 of Spade goes by two names** — *3 of Spade* and *Kadi Teeli*. Wherever the
game is titled (the tile band, the desk head) both are shown, one at a time,
each turning over on its X axis via `dcName` on a 9s infinite loop — 4.5s a
name, the second offset by half a cycle. It needs `both` fill or the delayed
name sits visible until its first turn. Under `prefers-reduced-motion` they
cannot take turns, so they render side by side as `3 of Spade / Kadi Teeli`.

The two game marks were removed while the artwork is reworked; the previous
builders are in git history. Archives, Players and the ghost tile keep theirs.
When the game marks return they are **redrawn per skin** so each belongs to its
own palette — never one flat mark pasted across every theme.

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

## Game rules the app encodes

### 3 of Spade — bid scored

Card values, for reference only (never entered): A/K/Q/J/10 are 10 each, the
**3 of Spades is 30**, each 5 is 5 — **250 points in one deck**, 500 in two.

Set once per session: the players, **how many decks** (1, 2 or 3, which caps every
bid at 250, 500 or 750), and **how many partners the bidder calls** (1 to 5 —
asked separately from the deck count, since either deck size can be played with
any of them).

Each hand records: the bidder, the bid, the **sir** (trump suit), and one called
card per partner. After the hand, who turned out to hold each called card, and
which side won.

**Scoring — a player takes the bid multiplied by the shares they hold:**

- the bidder holds 1 share, for bidding;
- a called-card holder holds 1 share **per called card they hold**, so a player
  holding two of them takes **2 × bid** — this is the *dual partner* and is the
  rule most easily got wrong;
- bidder's team wins → the bidding side takes their shares, opposition 0;
- opponents win → the bidding side takes 0 and **each** opponent takes the full
  bid, flat, never multiplied.

The bidder can never be a called-card holder. The same *player* may hold two
called cards — that is the dual partner.

**How many copies of a card can be asked for depends on the deck count.** One
deck means a called card is unique in the round. Two decks means both copies
exist, so the bidder may ask for the same card twice; three decks, three times.
A card is not "taken", it has capacity: `cardAtCapacity()` counts the copies
already asked for and only closes the chip at the deck count. Where two copies
of one card are called, the reveal numbers them (*copy 1 of 2*) so the two steps
are distinguishable, and a player holding both takes two shares.

Points collected out of 250/500 are **not** recorded — the winning side is
tapped outright.

### KaChuFull

Still the generic one-number-per-player-per-round sheet. Its real rules have not
been given yet; do not invent them.

## The app

`AP-CardGames.html` at the repo root is the working site: one self-contained file, no
build step, no dependencies. Open it directly or serve it anywhere static.

- Storage is `LocalStore` (this device's `localStorage`) by default.
  `FirestoreStore` implements the same interface and takes over as soon as
  `FIREBASE_CONFIG` is filled in at the top of the file. **Shared live sync is
  not active until those keys exist** — until then every device keeps its own copy.
- Routes: `#/` home, `#/new`, `#/session/<id>`, `#/archives`, `#/players`, `#/admin`.
  `#/new` and `#/session/<id>` render on the wide shell; everything else on the
  1240px floor.
- The 90 theme tokens are generated from `design/admin-theming/tokens.mjs`; never
  hand-edit them in `AP-CardGames.html`, edit the table and re-inject.
- Text that sits on the page ground (not on a panel) must use `--ground-ink` /
  `--ground-muted` on a `--ground-plate`. `--muted` is tuned for panels and is
  unreadable on a saturated ground — this is why the plate exists.

## Design directions (superseded by the app)

The live set is `design/home-final/` — four skins of the terminal layout,
carrying the real games and the presentation motion:

`design/theme-preview/` is the skin gallery — `build.mjs` reads the same token
table and writes `index.html`, so the preview cannot drift from the app. Re-run
it after any token change.

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
