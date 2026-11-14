# video-studio

Code-driven flat-vector videos for Instagram Reels, YouTube Shorts and regular YouTube.
An episode is a JSON file; commands turn it into a narrated, captioned video in 9:16 and 16:9.

**Start with [`PLAYBOOK.md`](PLAYBOOK.md)**: the channel's style, voice, script templates and
checklist. This file is the technical reference.

Built on [Remotion](https://www.remotion.dev) (React -> MP4).

## Quick start

```bash
npm install
npm run studio                                         # live preview in the browser
npm run render -- 001-why-is-the-sky-blue short        # -> out/<id>-short.mp4 (1080x1920)
npm run render -- 001-why-is-the-sky-blue              # both 9:16 and 16:9
```

Requires Node 22+ and ffmpeg. The first render downloads a headless Chrome; to reuse one you
already have, set `REMOTION_BROWSER=/path/to/chrome`.

## Making a video

```bash
npm run new -- info 003 "How do magnets work?"   # or: story 004 "..."
npm run narration -- <id>     # print the script with timings
npm run voiceover -- <id>     # speak it and fit each scene to its line
npm run captions -- <id>      # Whisper word timings + .srt
npm run render -- <id> short
```

Two pilots are included: `001-why-is-the-sky-blue` (informative, white) and
`002-the-man-who-sold-the-eiffel-tower` (story, night mode).

## Episode file

| Field | Meaning |
| --- | --- |
| `format` | `info` or `story`. Sets the default theme and voice speed. |
| `theme` | `light` (white) or `night` (black). |
| `stage` | Name of a custom animated stage from `src/stages/`. Optional. |
| `handle` | Channel handle shown on the outro. Defaults to `@frontierin60`. |
| `keywords` | Words highlighted in cyan in the captions. |
| `voice`, `voiceSpeed` | Override the house voice for this episode. |
| `captions` | `false` hides burned-in captions. |
| `music`, `musicVolume` | Background track in `public/audio/`. |
| `scenes` | The beats, in order. |

Every scene has `type`, `seconds`, and optionally `narration`, `beat` (a name the stage
animates on). Wrap words in
`*asterisks*` to highlight them.

| type | fields | use for |
| --- | --- | --- |
| `show` | `heading?`, `tag?`, `tagTone?` | letting the stage play, with a headline or tag above it |
| `statement` | `text`, `tag?`, `tagTone?` | a big line over the dimmed stage: hooks, turns, punchlines |
| `stat` | `value`, `label`, `prefix?`, `suffix?`, `decimals?` | one number that counts up |
| `list` | `heading`, `items[]`, `badges?[]` | recap card with 2-5 points |
| `bars` | `heading`, `bars[{label, value, color?}]`, `unit?` | comparing 2-5 values |
| `text` | `heading`, `body?`, `icon?` | one idea with an icon, for episodes without a stage |
| `outro` | `title`, `cta?`, `ctaNote?` | follow call to action |

`tagTone` is `dark`, `accent` or `alert`. The schema is in `src/types.ts`; an invalid episode
fails with a readable error.

## Custom stages

A stage is the episode's own animation: objects that appear and build up as the narration
reaches each beat. See `src/stages/sky.tsx` and `src/stages/eiffel.tsx`.

1. Create `src/stages/<name>.tsx` returning SVG drawn on a 1000x900 canvas (floor at y=830).
2. Register it in `src/stages/index.ts` and set `"stage": "<name>"` in the episode.
3. Give scenes a `"beat"` and animate with `useBeat("<beat>")` from `src/beats.tsx`
   (`enter()` for a spring, `ramp(from, to)` for linear progress, in seconds since the beat).
4. Build from the parts in `src/props.tsx`: `Box`, `Building`, `House`, `Person`, `Tag`,
   `DashedArrow`, `Wave`, `Cash`. They take colours from the theme, so a stage works in both
   light and night mode.

Beats start when their scene starts, so re-running the voiceover never breaks the sync.

## Voiceover

Speech comes from [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), a free open-source voice
that runs on your own machine (no account or API key). The first run downloads a ~90 MB model
from Hugging Face. ffmpeg is used to produce the MP3; without it a WAV is written instead.

```bash
npm run voiceover -- --voices                                   # list voices
npm run voiceover -- <episode-id> --voice am_liam --speed 1.05
```

The house voices are `am_liam` (info) and `am_puck` (story) (see `PLAYBOOK.md`, section 4). Voice names start with `af`/`am` (American female/male) or `bf`/`bm` (British). Set `"voice"` in
the episode JSON to make a choice stick. To use your own recording instead, put the file in
`public/audio/`, set `"voiceover"` to its name and adjust each scene's `seconds` by hand.

To compare another service later (ElevenLabs, OpenAI, ...), add it to `providers` in
`scripts/voiceover.mjs` and run with `--provider <name>`.

## Captions

`npm run captions -- <episode-id>` transcribes the voiceover with
[Whisper](https://github.com/ggml-org/whisper.cpp) (run through the HyperFrames CLI, which
downloads the Whisper runtime and model on first use). Whisper can mishear names and numbers, so
skim `captions/<id>.json` and correct any word. Use `--model small.en` for more accuracy, or set
`"captions": false` in an episode to hide them.

## HyperFrames

[HyperFrames](https://github.com/heygen-com/hyperframes) is a second way to build motion
graphics: plain HTML/CSS animated with GSAP instead of React. `hyperframes/` holds a starter
portrait composition.

```bash
cd hyperframes
npx hyperframes preview                  # live preview
npx hyperframes render -o ../out/clip.mp4
```

GSAP is loaded from `hyperframes/vendor/` so renders work offline. HyperFrames collects usage
data by default; turn it off with `npx hyperframes telemetry disable`.

## Reference videos

`npm run ref -- <video-url>` downloads a video (720p max) into `refs/` using
[yt-dlp](https://github.com/yt-dlp/yt-dlp) (`pip install yt-dlp`). `refs/` is not committed.
Use references to study pacing and style, not as footage in your own videos.

## Where things are

- `PLAYBOOK.md` - style, voice, script templates, checklist
- `episodes/` - one JSON file per video
- `src/scenes/index.tsx` - scene templates
- `src/stages/` - custom animated stages, one per episode that needs one
- `src/props.tsx` - flat-vector building blocks for stages
- `src/theme.ts` - the light and night themes, fonts and screen zones
- `src/Captions.tsx`, `src/Backdrop.tsx` - caption pill, grid floor
- `public/audio/` - voiceover and music files
- `captions/` - Whisper word timings and `.srt` files
- `references/` - your reference clips (video files are not committed)
- `hyperframes/` - HyperFrames starter composition
- `scripts/` - the commands above

## Notes

- Remotion is free for individuals and companies of up to three people; larger companies need a
  [licence](https://www.remotion.dev/docs/license).
- Only use music, fonts and assets you have the rights to publish. The bundled fonts (Passion One, Nunito) are OFL.
