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
- Open a loop the viewer wants closed, and where possible a second one: "Why is the sky blue?
  And why does it turn orange at sunset?" The second question is answered last.

**B. Animated subtitles, always**

- Captions are burned in, one short phrase at a time, popping in with the voice.
- The video's key words are highlighted in **cyan** in the captions (set `"keywords"` in the
  episode: for pilot 001 they are blue, sunlight, air, sunset and similar). Numbers are
  highlighted automatically. Many viewers watch muted; the highlighted words alone should tell
  the story.

**C. A visual change every 2-4 seconds**

- Something new must happen on screen at least every 2-4 seconds: a new object, a cut to a big
  statement, a colour change, a camera punch. Plan the shots as a list before building, e.g.
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
| Speed | 1.0 | 0.88 |
| Resulting pace | about 160 words/min | about 160 words/min |
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

- Length: **130-190 words** for an info video (45-65 s), **120-260** for a story (50-110 s).
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
| 5 | **Turn** | 55-75% | "But here's the odd part." A surprise or exception, then its short answer. |
| 6 | **Payoff** | 75-92% | Last step, then one line that ties back to the hook. |
| 7 | **Sign-off** | last 3 s | "Follow for more ..." Optional recap card worth saving. |

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
5. **Check** (section 7), **render**, upload. Upload the `.srt` from `captions/` to YouTube.

Scene types: `show` (stage plays, optional headline and tag), `statement` (big line over the
dimmed stage), `stat` (one number), `list` (recap card), `bars` (compare values), `text`
(icon + line, for videos without a stage), `outro` (follow). Full field list in `README.md`.

## 7. Checklist before publishing

- [ ] Every fact checked, sources noted in the brief.
- [ ] Hook lands in the first 3 seconds; headline readable with the sound off.
- [ ] Pace within 15 words/min of the target for the format.
- [ ] Something new on screen at least every 2-3 seconds.
- [ ] Captions skimmed for misheard words (names and numbers especially).
- [ ] First frame is a full picture; no logo or intro before the hook.
- [ ] Captions have their keywords set and highlighted.
- [ ] Nothing in the top 14%, the bottom 22%, or under the right-hand buttons.
- [ ] Under 60 seconds.
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

Published results:

| Video | Version | Result | What changed next |
| --- | --- | --- | --- |
| 001 sky | v1 (step tracker, slow open, no keyword highlights) | about 66% swiped away | Retention system added: full first frame, two-question hook, cyan keywords, tracker removed, safe zones |

To decide before going weekly:

- Voice: decided (`am_liam` info, `am_puck` story). Accent colour: decided (blue).
- Channel name: decided, Frontier in 60 (`@frontierin60`, shown on the outro only).
- Logo: exists (Instagram avatar); add the file to `public/` to show it on the outro.
- Character (possibly a story narrator): owner is thinking about it.
- Music and sound effects: the voice reference has none; the pilots have none.
- Niche: which topics the informative videos cover.
