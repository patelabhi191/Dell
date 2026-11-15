# Frontier in 60: Video Playbook

Channel: **Frontier in 60** (`@frontierin60`). Every video is **under 60 seconds**.

The standing brief for every video on this channel. Read it before writing a script, building a
scene, or rendering. If a video needs to break a rule here, change the rule here first.

Status: **pilot**. Target once the pilot is approved: **2 videos a week**, Instagram Reels and
YouTube (Shorts first, 16:9 optional).

## 1. What we make

Faceless animated videos, 40-58 seconds (never 60 or more), 9:16, with an AI voiceover and burned-in captions.

| Format | Share | Purpose | Default look |
| --- | --- | --- | --- |
| **Informative** (`"format": "info"`) | most videos | explain how or why one thing works | white stage (`light`) |
| **Story** (`"format": "story"`) | occasional | tell one true story with a twist | black stage (`night`) |

Either format can use either theme. White is the default; black is "night mode".

## Retention system (read this first)

The job of every video is to be watched to the end. The first upload of pilot 001 lost about
66% of viewers to an early swipe, so these rules now override anything else in this playbook.

**A. Hook immediately**

- Never open on a logo, a title card, the channel name or an introduction. The logo and handle
  appear only on the outro.
- The first words are the question or claim. The **first frame** is already a complete,
  interesting picture: nothing fades in from blank. It previews the payoff (pilot 001 opens on
  the finished blue sky, then rewinds to explain it).
- The hook is on screen as text within the first half second, readable with the sound off.
- The first spoken words are the shock itself ("One small box just stopped every plane in
  America from taking off"). Never open on a date, a greeting, a place name or context: put
  those on screen as a badge and say them second.
- The voice starts on frame one (the framework removes the lead-in silence for scene 1) and
  the hook line is read a little faster (`"speed": 1.14` on the first scene).
- Ask the viewer's question out loud within about 10 seconds ("So how does one box do
  that?") and answer it near the end.
- Open a loop the viewer wants closed, and where possible a second one: "Why is the sky blue?
  And why does it turn orange at sunset?" The second question is answered last.

**B. Animated subtitles, always**

- Captions are burned in, one short phrase at a time, popping in with the voice.
- The video's key words are highlighted in **cyan** in the captions (set `"keywords"` in the
  episode: for pilot 001 they are blue, sunlight, air, sunset and similar). Numbers are
  highlighted automatically. Many viewers watch muted; the highlighted words alone should tell
  the story.

**C. A visual change every 1.5-3 seconds**

- Something new must happen on screen at least every 1.5-3 seconds (the benchmark cuts every
  1.4 s on average): a new object, a cut to a big statement, a colour change, a camera punch. Plan the shots as a list before building, e.g.
  blue sky -> sunlight entering the air -> scattering -> orange sunset.
- No scene holds a single unchanged picture for longer than about 4 seconds. If the narration
  for a scene runs longer, give its stage more than one change or split the scene.

**D. Hold them to the end**

- Delay the payoff. The answer to the hook's main question lands in the last quarter, not the
  first.
- Use at least one mid-video turn ("but here's the odd part") to reopen curiosity around the
  halfway point, where attention usually sags.
- Do not signal the ending. No "so, in conclusion", no slow wind-down; the last line is the
  payoff, followed by a follow line of 2 seconds at most.
- No progress or step tracker ("STEP 2/4"). It tells viewers how much is left and gives them a
  reason to leave. Removed from the framework.
- Where it fits, let the last line lead back into the first so a replay feels natural.

**E. Measure and adjust**

- After each upload, record skip rate (left in the first 3 seconds) and the retention curve
  in section 9. A cliff at the start means the hook failed; a steady slide means the middle is
  slow; a drop near the end means the ending was signalled.
- Change one thing at a time between videos so the numbers mean something. Compare against
  our own earlier videos, not outside benchmarks: there is no official "good" figure.

These rules come from the owner's direction plus common practice described in creator and
analytics-vendor guides. Treat the timings as starting points to test, not proven laws.

## Benchmark reel (study this before every video)

A same-topic reel on the 13 Nov 2026 ground stop got **22K views**, more than ours. It is the
standard to beat; the owner does not need to resend it. The file is not committed (another
creator's work); this section records everything we learned from it. Never copy its script
lines, visuals or characters.

**What it is.** 47.7 s, 154 words, **197 words/min**, 33 cuts (one every 1.4 s). Dark night-map
look in 3D: a US map of city lights, airports, radar rooms, a clay-style controller, beige
network boxes. Captions are 1-3 words at a time with key words in a filled highlight box.

**Script, beat by beat.**

| Time | Beat | Line (paraphrased) | On screen |
| --- | --- | --- | --- |
| 0-3 s | Shock | America stopped every plane from taking off | Plane on runway, "FRIDAY 13 NOV 2026 · 3:54 PM ET" stamp, red GROUND STOP |
| 3-6 s | Rarity | Only twice before; the first was 9/11 | Three dated cards 2001 / 2023 / 2026 |
| 6-9 s | Rule out | Officials say it was not an attack | Map with an "attack?" tag, crossed out |
| 9-11 s | Relatable anchor | A network older than the iPhone choked | Beige box "JULY 2002" next to a phone |
| 11-20 s | Mechanism, in "you" | You're handed to one of 22 radar rooms; they keep you 5 miles apart by radar and radio | "22" over the map, controller at a scope, "5 miles" ring between two planes |
| 20-28 s | Cause | Both ride one network ordered in 2002; its routers flooded | Network boxes, "JULY 2002" label, radar going red |
| 28-36 s | Decision | With ~3,500 planes up, the FAA made one call: nobody new takes off for 4+ hours | Counter of planes in the air, big red GROUND STOP button, clock |
| 36-41 s | Stakes | "Here's what should bother you": a review called the network obsolete | Safety-review document over the boxes |
| 41-47 s | Question + loop | Would you pay $50B to replace it or hope it holds? Because last time it didn't | Cost counter, crossed-out box, back to the runway |

**What it does better than our 003 (and the rules we took from it).**

| | Benchmark | Our 003 v1 | Rule now |
| --- | --- | --- | --- |
| Pace | 197 words/min | 141 | Info videos run at **175-195 words/min** (voice speed 1.2, tight pacing) |
| Cuts | every 1.4 s | every ~4 s | A new picture or element every **1.5-3 s** |
| Captions | 1-3 words | up to 4 | **1-3 words** per caption |
| Data on screen | timestamp, counters, labels in every shot | some | Every scene shows at least one fact as a label, counter, stamp or card |
| Relatable anchor | "older than the iPhone" | none | Compare one key fact to something everyone knows |
| Viewer in the story | "you're handed to...", "keep you 5 miles" | mostly third person | Explain the mechanism in **second person** |
| Stakes | "Here's what should bother you" | none | Add a stakes beat in the last third: why it matters to the viewer |
| Ending | a question to answer in comments, then a loop line | "One box, a whole country" + follow | End on a **question to comment** plus a line that loops to the hook |

**Where we stay different on purpose.** White background (owner's choice), flat colourful
cartoon style with faces, blue accent. And we only state facts we can verify: the benchmark's
"3,500 planes", "review called it obsolete" and "$50 billion" were not confirmed, so 004 uses
verified alternatives (the 2009 outage on the same network, the $12.5B Congress approved).

**Versions to compare.** `003` (our first take, 141 words/min) vs `004` (rebuilt on these
rules, 181 words/min) vs `005` (same script, benchmark-style presentation, 187 words/min).
Post them at different times and log the results in section 9.

**Test look: "cinema" (episode 005).** Same content as 004, but presented the way the
benchmark presents: `"theme": "cinema"`, `"canvas": "full"`, `"captionStyle": "top"`.
- A full-screen stage owns the whole frame: a tilted night map of ~650 glowing city lights,
  airports, glowing flight paths and planes with light trails, drawn in CSS 3D perspective.
- A virtual camera glides between shots (tilt, rotate, zoom), including a close-up zoom onto
  two planes for "5 miles apart". The map fills most of the frame; nothing sits on a blank page.
- Every scene's facts are graphics inside the picture: dated plaques, a big red button, a
  glowing clock, "22", a live failed-center counter, the network rack with fiber pulses,
  screens dropping to NO CONNECTION, a report card, a hologram cube with a dollar counter.
- Text is small: captions of 1-3 words at the top (white, key words in a yellow box), plus
  small monospace labels. No headline slides.
- Palette: navy/black, warm city lights, yellow keys, green radar, cyan network, red alerts.
If 005 outperforms 004, this becomes the default look and the white style the alternative.

## Doom-scroll animation (CoComelon-inspired)

Our viewers arrive mid-scroll, already full of flashy, colourful, fast content. A calm
explainer that looks like a slideshow gets swiped. So every video borrows the *energy* of
toddler cartoons such as CoComelon, which are built to hold attention second by second.
We borrow the techniques only: never their characters, designs, songs or music.

1. **Nothing is ever still.** Every element is alive: planes fly, dials wiggle, characters
   blink and bob, clouds drift, dots pulse. A frozen frame is an exit.
2. **Bright and colourful on white.** Use several saturated colours for objects (blue,
   yellow, red-orange, green, purple, pink). Blue stays the "look here" colour for text.
3. **Give the key objects a face.** The thing the story is about (a plane, a router, a
   planet) gets simple eyes and a mouth that react: happy, curious, sad, panicked. Viewers
   follow a character far longer than a diagram.
4. **Bounce physics.** Things drop in from above and squash on landing, overshoot and settle,
   wobble when hit. Use springs, never linear slides.
5. **Every slide is a new picture.** Never reuse the previous picture with only a new caption.
   Change the viewpoint: map -> close-up -> pilot's-eye view -> character -> timeline.
6. **Point-of-view shots.** Put the viewer inside the moment (a cockpit on approach, a control
   room) at least once, ideally in the hook.
7. **Each slide enters differently.** The framework rotates entrances (slide, zoom, drop,
   tilt) so no two consecutive slides arrive the same way.
8. **Celebrate reveals.** Numbers and punchlines get a confetti burst and a slam-in.
9. **Land on the word.** Visual changes fire on the exact spoken word, using scene `cues`
   (e.g. dots turn red on "nothing", centers fail on "started").
10. **Put facts on screen.** Dates, times, counts and names appear as labels, clocks, cards
    and timelines, so a muted viewer still learns something every few seconds.

Style note: faces and dark outlines on characters are allowed; everything else stays flat.

## 2. The four reference clips

Keep the originals in `references/` (see `references/README.md`). They are for studying, never
for reuse: no footage, script lines, characters or mascots from them go into our videos.

| File | Use it for | What was measured |
| --- | --- | --- |
| `Animation_Style.mp4` | **the look** | 71 s, 200 words, 173 words/min. Off-white stage with a grid floor, flat blocky objects, one bright accent (lime there, blue for us), chunky uppercase headlines, step tracker on top, caption pill under the scene, a mascot, recap card + FOLLOW at the end. |
| `For_Knowledge_Info.mp4` | **informative structure** | 57 s, 153 words, 167 words/min. "Microwaves don't heat your food." Counter-intuitive hook, one mechanism, two everyday analogies, two "but here's the weird part" turns, a payoff line that ties back to the hook. |
| `For_Story_Time.mp4` | **story structure** | 109 s, 254 words, 142 words/min. Second person, present tense, cold open on the threat, named characters with labels, numbers as stakes, "here is your plan so far" recap, three labelled choices, ends on a question to comment. |
| `Voice.mp4` | **the voice** | 58 s, 161 words, 168 words/min. Male, median pitch about 128 Hz (range about 99-198 Hz), no music, clean silence between phrases. Night-mode chart video. |

Only the *style* comes from `Animation_Style`. The info and story clips use 3D and illustrated
art; we copy their pacing and structure, not their visuals.

## 3. Visual style

Everything below is already built into the Remotion project; this is the spec it follows.

**Stage.** Flat studio: soft vignette background, perspective grid floor in the lower part of
the frame. Objects stand on the floor with a soft contact shadow.

| Token | Light (white) | Night (black) |
| --- | --- | --- |
| Background | `#F2F0EC` | `#0C0D10` |
| Ink (text, figures) | `#141414` | `#F4F3EE` |
| Accent (the one bright colour) | `#2563FF` blue | `#4D8DFF` blue |
| Alert (warnings, stamps) | `#F04E23` | `#FF5A36` |
| Neutral objects | `#878796` slate | `#6B6D7C` slate |
| Tags and caption pill | `#17181C`, white text | `#1D1F26`, white text |

**Rules**

- One accent colour: **blue**. (The style reference uses lime; we chose blue.) It marks the thing the viewer should look at: the hero, the key word,
  the current step. Red-orange is only for warnings and stamps. Extra colours only when the
  subject needs them (the colours of light, a chart line).
- Objects are flat shapes with three shades at most (front, darker side, lighter top). No
  gradients on objects, no outlines, no photos, no AI-generated images in this style.
- Type: **Passion One** uppercase for headlines, **Nunito** 900 for tags, captions and body.
- Headlines are short: 2-6 words, one or two highlighted with `*asterisks*`.
- **Safe zones** (measured from a screenshot of our own Reel on a notched iPhone; all values on
  the 1080x1920 frame). Text, captions and anything that matters stay inside them:
  - Top 14% (above y=270) is empty: status bar, Dynamic Island / notch and the "Reels" header.
  - Bottom 22% (below y=1500) is empty: username, caption and audio row.
  - Right edge (x beyond 890) is empty from 55% down: like, comment and share buttons.
  - About 5% on each side can be cropped on tall phones: keep 110 px side margins.
  - Order inside the safe area: headline or tag, stage, caption pill (centred near 69%).
  The layout enforces this; a custom stage must not draw outside its canvas.
- Motion: things pop or grow in (spring), headlines stamp in word by word, one new thing at a
  time, timed to the word that names it.
- **Keep it active.** The goal is that people watch to the end, so the frame is never still:
  - Built in for every video: the floor glides, small shapes drift up, the camera punches in
    on each cut and pushes slowly through the scene, captions pop per phrase, figures and tags
    sway.
  - Per stage: add ambient life that fits the setting (clouds, birds, a tree, twinkling stars,
    a searchlight, a passing train) and small reactions (a "?" over a doubtful character, a
    "!" on the one who acts).
  - Something new should appear at least every 2-3 seconds. If a scene holds longer than
    that with nothing changing, add an element or split the scene.
  - Ambient motion stays small and slow; it must never compete with the thing being explained.
- The scene **builds up**: objects stay on stage and accumulate across steps. Punchlines dim
  the stage and put one big line over it.
- Logo / character: the channel has a logo; it goes on the outro only, never the opening.
  The owner is considering an original character, possibly one that narrates the stories. To be added later; it must be our own
  design, not the reference's mascot.

## 4. Voice

The reference voice is almost certainly text-to-speech (studio-clean, no room tone, very even
pace). Which product made it cannot be told from the file.

**House voices (chosen by the owner after listening to samples): Kokoro `am_liam` for
informative videos, Kokoro `am_puck` for stories.** Kokoro is free, open-source (Apache 2.0,
fine for monetised videos) and runs locally.

| Setting | Informative | Story |
| --- | --- | --- |
| Voice | `am_liam` | `am_puck` |
| Speed | 1.2 default (1.25 in the 005 test), with tight pacing (`"pacing"` in the episode) | 0.88 |
| Resulting pace | about 180 words/min (benchmark: 197) | about 160 words/min |
| Reference pace | 167-173 | 142 |

Other voices to try with `--voice`: `am_fenrir` (measured closest to the reference's pitch),
`am_michael` (deeper, calmer).

Other routes, if Kokoro is not close enough:

- **ElevenLabs** is the most likely source of voices like the reference. Its free tier is
  reported as non-commercial; monetised videos need a paid plan. Check their current terms.
- **Chatterbox** (open-source, MIT) is higher quality than Kokoro but needs a GPU.
- **edge-tts** (Microsoft voices) is free to call but not clearly licensed for publishing.

A new provider plugs into `scripts/voiceover.mjs` (`providers`), so voices can be compared on
the same script with `--provider`.

## 5. Script rules

- Length: **140-170 words** for an info video (45-58 s at 175-195 words/min), **120-260** for a story (50-110 s).
- Sentences are short: 4-10 words. One idea per sentence. Fragments are fine. ("Left, right.
  Billions of times every second.")
- Plain words. Say numbers the way a person would. Use concrete numbers and names.
- Second person and present tense wherever possible.
- Every factual claim must be checked against a reliable source before rendering. List the
  sources in the brief. If a claim is disputed or approximate, say "about" or cut it.
- On-screen text never repeats the narration word for word; it labels what is being shown.
- Write the narration per scene. One scene = one visual change = 1-3 sentences.

### Informative template

| # | Beat | Share of runtime | What happens |
| --- | --- | --- | --- |
| 1 | **Hook** | 0-7% | A question or a claim that sounds wrong. Headline on screen, stage previewed. |
| 2 | **Setup** | 7-20% | The one thing the viewer needs first. |
| 3 | **Mechanism** | 20-50% | 2-4 steps, each adds one object or change to the stage. |
| 4 | **Number** | about 50% | One figure as a big stat. |
| 5 | **Turn** | 55-70% | "But here's the odd part." A surprise or exception, then its short answer. |
| 6 | **Stakes** | 70-85% | "Here's what should bother you." Why it matters to the viewer; a verified fact. |
| 7 | **Question + loop** | last 4 s | A question viewers can answer in a word in the comments, with a line that echoes the hook. |

Explain the mechanism in second person ("you're handed to...") and include one relatable
comparison ("older than the iPhone").

### Story template

| # | Beat | Share of runtime | What happens |
| --- | --- | --- | --- |
| 1 | **Cold open** | 0-10% | The most surprising fact of the story, stated flat. |
| 2 | **Place and person** | 10-25% | Where, when, who. Name the hero and label them on screen. |
| 3 | **The plan** | 25-45% | What they set out to do, in steps. |
| 4 | **The stakes** | 45-60% | A number, a risk, a secret. |
| 5 | **The move** | 60-75% | The thing happens. Stamp it on screen. |
| 6 | **Twist** | 75-90% | What nobody expected, as a big line over the dimmed stage. |
| 7 | **Question** | last 4 s | A question the viewer can answer in one word in the comments, then the follow line. |

## 6. Production workflow

All commands run inside `video-studio/`.

```bash
npm run new -- info 003 "How do magnets work?"    # or: story 004 "..."
npm run narration -- <id>      # proofread the script with timings
npm run voiceover -- <id>      # speak it, fit every scene to its line
npm run captions -- <id>       # Whisper word timings + .srt
npm run studio                 # preview
npm run render -- <id> short   # out/<id>-short.mp4 (drop "short" for 16:9 too)
```

1. **Brief** (section 8) filled in.
2. **Script** written into `episodes/<id>.json`, one scene per beat, following the template.
3. **Stage**: if the video needs its own visuals, add `src/stages/<name>.tsx`, register it in
   `src/stages/index.ts`, set `"stage": "<name>"`, and give scenes a `"beat"` name to animate on.
   Build it from `src/props.tsx` (Box, Building, House, Person, Tag, DashedArrow, Wave, Cash).
4. **Voiceover**, then **captions**. Re-run both whenever the narration changes.
5. **Cover**: add covers to the episode's `"thumbnails"` list (name, title, tag, and the beat +
   offset of the frame to freeze, or `"at": "cover"` for a cover-only picture the stage draws)
   and run `npm run thumbnail -- <id>`. The cover must not give away the answer: show the
   mystery (a box with a face), not the reveal (the router). Keep the title and the main
   character inside the middle 4:5 area, which is what the profile grid shows.
6. **Post caption**: write `posts/<id>.md` with the caption, hashtags and sources: first line
   repeats the hook, then 3-4 short factual lines, a question to comment on, the follow line,
   and **exactly 5 hashtags** (Instagram's limit): 3 for the topic, 1 for the field, 1 for the
   format (e.g. `#FAA #AirTravel #Aviation #GroundStop #Explained`).
7. **Check** (section 7), **render**, upload. Upload the `.srt` from `captions/` to YouTube.

Scene types: `show` (stage plays, optional headline and tag), `statement` (big line over the
dimmed stage), `stat` (one number), `list` (recap card), `bars` (compare values), `text`
(icon + line, for videos without a stage), `outro` (follow). Full field list in `README.md`.

## 7. Checklist before publishing

- [ ] Every fact checked, sources noted in the brief.
- [ ] Hook lands in the first 3 seconds; headline readable with the sound off.
- [ ] Pace within 15 words/min of the target for the format (info: 175-195).
- [ ] Stakes beat present; ends on a question to comment.
- [ ] Something new on screen at least every 2-3 seconds.
- [ ] Captions skimmed for misheard words (names and numbers especially).
- [ ] First frame is a full picture; no logo or intro before the hook.
- [ ] Captions have their keywords set and highlighted.
- [ ] Nothing in the top 14%, the bottom 22%, or under the right-hand buttons.
- [ ] Under 60 seconds.
- [ ] Voice starts on frame one with the shock line; no date or context first.
- [ ] Cover rendered and checked in the 4:5 crop; post caption and sources written.
- [ ] Only one accent colour doing the pointing; no stray colours.
- [ ] Nothing copied from a reference clip or anyone else's video.
- [ ] Watched once at full speed on a phone.

## 8. Brief for a new video

The owner usually sends a brief in this shape; it is enough to start from:

```text
Opening hook (0-3 sec):  the question or claim, in quotes
The story (45-60 sec):   the facts, in a few paragraphs
Visual direction:        bullet list of what to show, in order
```

Turn it into a video like this: keep the hook as the first line; rewrite the story into short
spoken sentences (about 140-155 words); translate "shots" and "footage" into flat-vector
scenes in the house style; check every fact and report any that could not be confirmed. If
format or theme is not stated, choose them. Optional extra fields:

```text
Format:      info | story
Topic:       (one sentence: what the viewer will understand or hear)
Hook idea:   (the surprising claim or question)
Key facts:   (bullet list, each with a source link)
Theme:       light | night
Length:      about 50 s
Stage idea:  (what should physically be on screen and build up)
Sign-off:    (follow line, or a question to comment)
```

## 9. Pilot results and open decisions

| Pilot | Format | Theme | Length | Pace |
| --- | --- | --- | --- | --- |
| `001-why-is-the-sky-blue` | info | light | 59 s | 165 words/min |
| `002-the-man-who-sold-the-eiffel-tower` | story | night | 46 s | 159 words/min |
| `003-the-router-that-grounded-america` | info (news explainer) | light | 58 s | 141 words/min |
| `004-one-box-grounded-america-v2` | info, rebuilt on the benchmark rules | light | 53 s | 181 words/min |
| `005-one-box-grounded-america-cinema` | info, benchmark-style presentation (test) | cinema | 52 s | 187 words/min |

Published results:

| Video | Version | Result | What changed next |
| --- | --- | --- | --- |
| 001 sky | v1 (step tracker, slow open, no keyword highlights) | about 66% swiped away | Retention system added: full first frame, two-question hook, cyan keywords, tracker removed, safe zones |
| Benchmark (not ours) | same topic as 003/004 | 22K views | Benchmark section and rules above |

To decide before going weekly:

- Voice: decided (`am_liam` info, `am_puck` story). Accent colour: decided (blue).
- Channel name: decided, Frontier in 60 (`@frontierin60`, shown on the outro only).
- Logo: exists (Instagram avatar); add the file to `public/` to show it on the outro.
- Character (possibly a story narrator): owner is thinking about it.
- Music and sound effects: the voice reference has none; the pilots have none.
- Niche: which topics the informative videos cover.
