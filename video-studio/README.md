# video-studio

Code-driven **flat-vector** explainer videos for Instagram Reels, YouTube Shorts and regular YouTube.
You write an episode as a JSON file; one command renders it in both 9:16 and 16:9.

Built on [Remotion](https://www.remotion.dev) (React → MP4).

## Quick start

```bash
npm install
npm run studio                                   # live preview in the browser
npm run render -- 001-why-is-the-sky-blue        # -> out/<id>-short.mp4 and out/<id>-long.mp4
```

Requires Node 22+ and ffmpeg. The first render downloads a headless Chrome; to reuse one you already have,
set `REMOTION_BROWSER=/path/to/chrome`.

## Weekly workflow

1. `npm run new -- 002 "How do magnets work?"` creates `episodes/002-how-do-magnets-work.json`.
2. Fill in the scenes (see below). Write the voiceover line for each scene in `narration`.
3. `npm run narration -- 002-how-do-magnets-work` prints the script so you can proofread it.
4. `npm run voiceover -- 002-how-do-magnets-work` speaks every scene's narration, stretches each
   scene's `seconds` to fit its line, and writes `public/audio/<id>.mp3`. Re-run it whenever the
   narration changes. Optional background track: `"music": "loop.mp3"`.
5. `npm run captions -- 002-how-do-magnets-work` runs Whisper on the voiceover and writes word
   timings to `captions/`. They are burned into the video; the `.srt` is for YouTube subtitles.
6. `npm run studio` to check timing, then `npm run render -- 002-how-do-magnets-work`.
7. Upload `-short.mp4` to Reels/Shorts and `-long.mp4` to YouTube.

## Voiceover

Speech comes from [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), a free open-source voice
that runs on your own machine (no account or API key). The first run downloads a ~90 MB model
from Hugging Face. ffmpeg is used to produce the MP3; without it a WAV is written instead.

```bash
npm run voiceover -- --voices                                   # list voices
npm run voiceover -- <episode-id> --voice bm_george --speed 1.1
```

Voice names start with `af`/`am` (American female/male) or `bf`/`bm` (British). Set `"voice"` in
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

## Scene types

Every scene has `type`, `seconds`, and optional `narration`.

| type    | fields                                                    | use for                    |
| ------- | --------------------------------------------------------- | -------------------------- |
| `title` | `title`, `kicker?`                                        | opening hook               |
| `text`  | `heading`, `body?`, `icon?`                               | one idea per screen        |
| `stat`  | `value`, `label`, `prefix?`, `suffix?`, `decimals?`       | a big number that counts up |
| `bars`  | `heading`, `bars[{label, value, color?}]`, `unit?`        | comparing 2-5 values       |
| `list`  | `heading`, `items[]`                                      | 2-5 points, revealed in turn |
| `outro` | `title`, `cta`                                            | call to action             |

Icons: `sun`, `eye`, `bulb`, `wave`, `globe`, `clock`, `spark`.
The schema lives in `src/types.ts`; an invalid episode fails with a readable error.

## Where things are

- `episodes/` - one JSON file per video
- `src/scenes/index.tsx` - scene templates (add a new scene type here and in `src/types.ts`)
- `src/theme.ts` - colour themes (`midnight`, `paper`) and safe areas for platform UI
- `src/Icon.tsx` - flat icons
- `src/Background.tsx` - drifting background shapes
- `public/audio/` - voiceover and music files
- `captions/` - Whisper word timings and `.srt` files
- `hyperframes/` - HyperFrames starter composition
- `scripts/voiceover.mjs` - text-to-speech

## Notes

- Remotion is free for individuals and companies of up to three people; larger companies need a
  [licence](https://www.remotion.dev/docs/license).
- Only use music, fonts and assets you have the rights to publish. Poppins (bundled) is OFL.
