# Frontier in 60: Video Playbook

Channel: **Frontier in 60** (`@frontierin60`). Every video is **under 60 seconds**.

The standing brief for every video on this channel. Read it before writing a script, building a
scene, or rendering. If a video needs to break a rule here, change the rule here first.

Status: **upgrading to the reference style** (section 2). Target: **2+ videos a week** on
Instagram Reels, also posted to YouTube Shorts.

## 1. What we make

Faceless animated explainers, 40-58 seconds (never 60 or more), 9:16, AI voiceover, burned-in
captions. **Every frame is filled edge to edge with a lit, detailed, moving world**; no slide
of text on an empty background.

| Format | Share | Purpose |
| --- | --- | --- |
| **Informative** (`"format": "info"`) | most videos | how or why one thing works, often tied to the news |
| **Story** (`"format": "story"`) | occasional | one true story with a twist |

New videos use the reference look by default: `"theme": "cinema"`, `"canvas": "full"`,
`"captionStyle": "box"`, built from the kit in `src/kit/` (section 4).

## 2. Reference base (the five reels)

These five reels are **the** reference for how our videos look, move, caption and are written.
They replace all earlier references (see "Archive" at the end). The files stay on the owner's
machine in `references/` and are not committed: they are other creators' work. We copy the
*techniques*, never their scripts, characters, logos or exact designs. Four come from one
explainer channel ("Why Though?").

| # | Topic | Length | Words | Pace | World it builds |
| --- | --- | --- | --- | --- | --- |
| R1 | GTA 6 preload downloads (CDNs) | 42 s | 110 | 157 wpm | Neon synthwave city with a glowing server tower; a spinning globe with download arcs; split screen "one bottleneck vs distributed" |
| R2 | How AirDrop works offline | 70 s | 200 | 172 wpm | Voxel isometric hiking landscape at dusk; two people with phones; a glowing arc between phones |
| R3 | How newsletters avoid spam and track opens | 95 s | 263 | 166 wpm | Dark isometric grid world: server stacks, envelopes, a globe, a "spam filter" gate, a 1-pixel grid |
| R4 | Why the Microsoft outage spread | 97 s | 257 | 159 wpm | Isometric rows of server racks going red; a 10-lane motorway jam as the analogy; falling dominoes |
| R5 | Why shop alarms beep after you paid | 48 s | 153 | 204 wpm | Near-photoreal 3D shop at night: glowing security gates, macro shots of the tag, a barcode scanner |

### What all five do (the rules we take from them)

**Screen**
- **Full-bleed, always.** The world fills the whole 9:16 frame, including behind the captions
  and the platform buttons. Dark navy/charcoal base, but almost every pixel is covered by lit
  objects, grids, glows or particles. The background colour is never what you see.
- **One world per video.** Each video builds one metaphor-world (a city, a server room, a
  landscape, a shop) and the camera moves around it: push in to a macro close-up, pull out to a
  wide, orbit, cut to a globe and back. Hard cuts are rare (0-18 per video); the picture
  changes by camera move and by things appearing.
- **Depth and light.** 3D or isometric depth, rim light, neon glows, light trails, soft shadows,
  particles and reflections. Objects look solid, not flat.
- **Colour code.** Cyan = how it works / healthy. Red = problem / failure. Amber = warning /
  "suspicious". Green = OK / delivered. Pink/purple accents for mood (R1).

**On-screen information**
- **A status HUD across the top** that changes with the story: connection state ("SEARCHING ·
  BLUETOOTH · DIRECT WI-FI · DELIVERED"), server lights, or chapter tabs ("SEND · SIGN · PACE ·
  TRACK · TWIST"). It reports the *state of the system*, not "step 2 of 4".
- **Labels pinned to things** with a dot and a leader line: small uppercase tags ("TAG RINGS
  BACK", "SPAM FILTER", "CONTENT DELIVERY NETWORK"). Filled tag = the key point; outlined = context.
- **Data graphics inside the world:** signal waveforms, meters, bar charts, progress bars, a
  dial gauge, ✓/✗ checklists ("TECHNICAL ISSUE ✓, CYBERATTACK ✗"), counters, distance rings
  ("about 9 m").
- **Receipts.** Screenshots of news articles and official pages with the source line visible
  ("abcnews.com", "Apple Support"), and short quotes ("Microsoft said").
- **Honesty notes** in tiny type: "SIMPLIFIED EXAMPLE", "ILLUSTRATION · NOT REAL FOOTAGE · AI
  VOICE · SOURCES IN CAPTION".
- **Title cards only twice:** a big two-line hook card at the start ("MILLIONS DOWNLOADING
  GTA 6?!") and the closing question card ("WILL LAUNCH DAY GO SMOOTHLY?").
- **Brand badges** for the products involved (app icons, logos), small.

**Captions**
- 3-5 words at a time, one line, white, the key word in **cyan** (R5 uses filled yellow/cyan
  boxes). In a dark box with a thin cyan border (R3, R4) or a dark pill (R2), low in the frame;
  R1/R5 put them near the top. Ours: the cyan-bordered box, low (`"captionStyle": "box"`).

**Script (the same 9 beats in every reel)**

| # | Beat | Example from the references |
| --- | --- | --- |
| 1 | **Surprising fact** about something the viewer uses | "AirDrop can send a video with no Wi-Fi and no internet at all." |
| 2 | **The question** | "So how does the video get there?" |
| 3 | **"Imagine…"**: put the viewer in a scene, or an everyday analogy | "Imagine you're on a hike with no signal." / "Imagine a motorway with 10 lanes." |
| 4 | **"Here's what happens."** | (turns the corner into the mechanism) |
| 5 | **Mechanism in 2-4 steps**, "First… But… So…" | Bluetooth finds the phone; Wi-Fi Direct sends the file |
| 6 | **"But there's a catch" / "here's the twist"** | "Only within about 9 metres." / "Apple Mail fakes opens." |
| 7 | **Callback recap**: "So, that ___?" + one-line answer | "So that video? It never touched the internet." |
| 8 | **Comment question** answerable in a word | "Metal strips or paper coil? Which one caught you out?" |
| 9 | **Share line** naming a type of friend | "Send this to the friend who blamed their own Wi-Fi on Friday." |

Also: second person throughout; one everyday analogy per video; cross-reference earlier videos
("Remember our launch-day video?") once the channel has a back catalogue; state uncertainty
plainly ("a full report is still to come").

**Pace.** 157-204 words/min (median about 165). Ours: Liam at 1.2× ≈ 180 words/min.

### Where we differ on purpose
- **Length:** the references run 42-97 s; ours stay **under 60 s** (the channel name). Cut
  beats 3 or 6 short rather than rushing the voice.
- **Our voice** (section 5), our colours and our own world designs.
- **Verified facts only**, listed in the post with sources.
- **Safe zones** (section 3): the references put the HUD at the very top; on Instagram that is
  under the app's header, so ours starts at y=270.

### What we can and cannot match yet
The references are rendered 3D (lighting, reflections, depth of field). We build in code
(Remotion, SVG, CSS 3D perspective and glow filters), which gets close for isometric worlds,
globes, maps, HUDs and data graphics, but not for photoreal scenes like R5's shop. Detail grows
with the kit: every video should add one or two reusable pieces. If photoreal scenes become a
must, the next step is real 3D in Remotion (`@remotion/three`).

## 3. Retention rules (apply to every video)

**A. Hook immediately**
- First frame = a complete, detailed, lit picture plus the hook title card. Nothing fades in
  from black. No logo or channel intro.
- First spoken words = the surprising fact. The voice starts on frame one (the framework drops
  the lead-in silence for scene 1); read the hook slightly faster (`"speed": 1.24`).
- Ask the question out loud within about 6 seconds (beat 2).

**B. Captions always**, 3-5 words, key words in cyan (`"keywords"` in the episode; numbers
are automatic). The highlighted words alone should tell the story with the sound off.

**C. Constant change.** Something new every 1.5-3 s: a label pops, a counter moves, the camera
pushes or orbits, a light changes colour. Ambient motion never stops (lights flicker, particles
drift, objects idle).

**D. Hold them to the end.** The twist (beat 6) lands in the last third; the callback (beat 7)
makes the ending satisfying; never signal the ending. The HUD shows system state, never a
"steps left" count.

**E. Measure.** After each upload log skip rate, average watch time and shares in section 10.
Change one thing at a time.

**Safe zones** (measured on our own Reel on a notched iPhone; 1080x1920 frame). The *world*
fills everything; *text and key graphics* stay inside:
- Top 14% (above y=270): status bar, Dynamic Island, "Reels" header. HUD starts at y≈300.
- Bottom 22% (below y=1500): username, caption, audio row.
- Right edge (x > 890) from 55% down: like, comment, share buttons.
- Keep 110 px side margins (tall phones crop the edges).
- Caption box sits at y≈1330-1420.

## 4. Visual kit (`src/kit/index.tsx`)

The building blocks for the reference look. A test sheet of all of them: compositions
`kit-gallery-1`, `-2`, `-3` and `kit-endcard` in the studio.

| Piece | Use |
| --- | --- |
| `KitDefs` | glow filters, globe gradient and vignette (put once in each `<svg>`) |
| `IsoFloor` | full-bleed scrolling isometric grid, the base of most worlds |
| `isoAt`, `IsoBox` | isometric projection and lit 3-face boxes for building any object |
| `ServerRack`, `IsoBuilding`, `IsoTree`, `VoxelPerson` | ready-made world objects with lights |
| `Globe` | orthographic spinning globe, graticule, glowing cities, arcs from a hotspot |
| `StatusBar`, `ChapterTabs` | the top HUD (system state or chapters) |
| `Callout` | label pinned to a point with a leader line (cyan/red/amber/green/plain) |
| `Waveform`, `Meter`, `BarChart`, `Checklist`, `BigStat` | data graphics |
| `NewsCard` | article screenshot with source line ("receipts") |
| `TitleCard` | the two big title cards (hook and closing question) |
| `Disclaimer` | tiny honesty footer |
| `EndCard` | channel card with a follow button being tapped |

Palette (`K`): bg `#070B14`, cyan `#2ED3FF`, red `#FF4D5E`, amber `#FFB23F`, green `#3BE38B`,
white `#F2F6FF`, muted `#7E8BA8`. Fonts: Passion One for title cards, Nunito 900 for labels and
captions, DejaVu Sans Mono for HUD/data text.

Each video gets its own full-screen stage in `src/stages/` (registered in `fullStages`), built
from the kit plus a camera (see `groundstop-cinema.tsx` for a full example: perspective map,
camera targets per beat, cues on spoken words).

## 5. Voice (unchanged)

**House voices (chosen by the owner): Kokoro `am_liam` for informative videos, `am_puck` for
stories.** Free, open-source (Apache 2.0), runs locally.

| Setting | Informative | Story |
| --- | --- | --- |
| Voice | `am_liam` | `am_puck` |
| Speed | 1.2 (1.25 allowed), tight `"pacing"` | 0.88 |
| Pace | about 180-187 words/min | about 160 words/min |

Other routes if ever needed: ElevenLabs (paid plan for monetised use), Chatterbox (MIT, needs
a GPU). New providers plug into `scripts/voiceover.mjs`.

## 6. Script rules

- **130-160 words** for an info video (45-58 s at about 180 words/min).
- Follow the 9 beats in section 2. Short sentences (4-10 words), plain words, numbers said the
  way a person says them, second person.
- Every factual claim checked against a reliable source before rendering; sources go in the
  post file. If something is uncertain, say so on screen and in the voice.
- On-screen labels never repeat the narration word for word; they name what is shown.
- One scene per beat or sub-step; give each a `"beat"` and use `"cues"` to land visuals on
  the exact spoken word.

### Story template (stories keep this structure, in the reference look)

| # | Beat | What happens |
| --- | --- | --- |
| 1 | **Cold open** | The most surprising fact, stated flat |
| 2 | **Place and person** | Where, when, who; label the hero |
| 3 | **The plan** | What they set out to do, in steps |
| 4 | **The stakes** | A number, a risk, a secret |
| 5 | **The move** | It happens; stamp it on screen |
| 6 | **Twist** | What nobody expected |
| 7 | **Question + share** | A one-word comment question, then the share line |

## 7. Production workflow

All commands run inside `video-studio/`.

```bash
npm run new -- info 006 "How does AirDrop work offline?"   # scaffold
npm run narration -- <id>       # proofread the script with timings
npm run voiceover -- <id>       # speak it, fit every scene to its line
npm run captions -- <id>        # Whisper word timings + .srt
npm run studio                  # preview
npm run render -- <id> short    # out/<id>-short.mp4
npm run thumbnail -- <id>       # covers
```

1. **Brief** (section 8).
2. **World design**: pick the one metaphor-world and list the shots (camera moves) per beat.
3. **Script** in `episodes/<id>.json` with the 9 beats; set `theme: cinema`, `canvas: full`,
   `captionStyle: box`, `keywords`.
4. **Stage**: `src/stages/<name>.tsx` from the kit, registered in `fullStages`; status HUD,
   pinned labels and data graphics in every shot; title cards at the start and end; honesty
   footer.
5. **Voiceover**, **captions** (skim for misheard words).
6. **Cover**: a frame of the world with a short title; show the mystery, not the answer;
   inside the 4:5 crop.
7. **Post** (`posts/<id>.md`): hook line, 3-4 factual lines, comment question, share line,
   follow line, **exactly 5 hashtags**, sources.
8. **Check** (section 9), render, upload (also to YouTube Shorts).

## 8. Brief for a new video

The owner's usual brief is enough:

```text
Opening hook (0-3 sec):  the surprising fact, in quotes
The story (45-60 sec):   the facts, in a few paragraphs
Visual direction:        what to show, in order (optional)
```

Turn it into: the 9 beats; one world; facts verified (report any that could not be). Visual
direction like "aerial shot" or "footage" becomes a camera move in our built world.

## 9. Checklist before publishing

- [ ] Every frame filled edge to edge; no empty background showing.
- [ ] One world, with camera moves; status HUD; pinned labels; at least one data graphic or
      receipt per beat.
- [ ] Hook title card on frame one; question asked by about 6 s.
- [ ] 9 beats present: twist in the last third, callback, comment question, share line.
- [ ] Captions 3-5 words, keywords set, misheard words fixed.
- [ ] Text and key graphics inside the safe zones.
- [ ] Under 60 s; pace about 180 words/min.
- [ ] Facts verified; sources in the post; honesty footer on screen.
- [ ] Cover in the 4:5 crop; post with exactly 5 hashtags.
- [ ] Nothing copied from a reference; watched once on a phone at full speed.

## 10. Results log and open decisions

| Video | Look | Length | Pace | Result |
| --- | --- | --- | --- | --- |
| `001-why-is-the-sky-blue` | white (old) | 59 s | 165 | about 66% swiped away |
| `002-the-man-who-sold-the-eiffel-tower` | night (old) | 46 s | 159 | not posted |
| `003-the-router-that-grounded-america` | white (old) | 58 s | 141 | |
| `004-one-box-grounded-america-v2` | white (old), benchmark pacing | 53 s | 181 | |
| `005-one-box-grounded-america-cinema` | cinema (first step toward the new look) | 52 s | 187 | |
| `006-one-box-grounded-america-3d` | real 3D world on the GPU (`@remotion/three`) + kit HUD, box captions | 52 s | 187 | |

Open decisions: logo file for the end card (add to `public/`); an original character (owner
thinking); music and sound effects (none in the references we can hear clearly; none yet);
topics niche (the references suggest everyday tech explained, tied to the news).

## Archive (retired references)

Superseded by section 2 on the owner's instruction; kept only as history.
- **Original four clips** (Animation_Style, For_Knowledge_Info, For_Story_Time, Voice): gave
  the white flat-vector look, the first script templates and the voice match.
- **Ground-stop benchmark reel** (22K views): taught pace (about 190 wpm), constant change,
  data labels, a stakes beat and a comment-question ending.
- **CoComelon-style rules**: faces on objects, bounce physics, bright colours on white.
The old white look (`theme: light`, slide scenes, `src/props.tsx`, `src/stages/groundstop.tsx`)
still works for re-renders of 001-004 but is no longer used for new videos.
