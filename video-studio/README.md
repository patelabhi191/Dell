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

Requires Node 20+. The first render downloads a headless Chrome; to reuse one you already have,
set `REMOTION_BROWSER=/path/to/chrome`.

## Weekly workflow

1. `npm run new -- 002 "How do magnets work?"` creates `episodes/002-how-do-magnets-work.json`.
2. Fill in the scenes (see below). Write the voiceover line for each scene in `narration`.
3. `npm run narration -- 002-how-do-magnets-work` prints the timed script and flags scenes
   whose narration is too long for their `seconds`.
4. Record or generate the voiceover, save it in `public/audio/`, and set `"voiceover": "002.mp3"`
   in the episode. Optional background track: `"music": "loop.mp3"`.
5. `npm run studio` to check timing, then `npm run render -- 002-how-do-magnets-work`.
6. Upload `-short.mp4` to Reels/Shorts and `-long.mp4` to YouTube.

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

## Notes

- Remotion is free for individuals and companies of up to three people; larger companies need a
  [licence](https://www.remotion.dev/docs/license).
- Only use music, fonts and assets you have the rights to publish. Poppins (bundled) is OFL.
