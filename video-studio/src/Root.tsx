import "@fontsource/passion-one/400.css";
import "@fontsource/passion-one/700.css";
import "@fontsource/passion-one/900.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import React from "react";
import { Composition, Folder, continueRender, delayRender } from "remotion";
import { EpisodeVideo, FPS, episodeFrames } from "./EpisodeVideo";
import type { CaptionWord } from "./Captions";
import { episodeSchema, type Episode } from "./types";

// Every JSON file in /episodes becomes two compositions: <id>-short and <id>-long.
const ctx = (require as any).context("../episodes", false, /\.json$/);
const episodes: Episode[] = ctx.keys().map((key: string) => {
  const parsed = episodeSchema.safeParse(ctx(key));
  if (!parsed.success) {
    throw new Error(`Invalid episode ${key}:\n${parsed.error.message}`);
  }
  return parsed.data;
});

// Word timings from `npm run captions`, keyed by episode id.
const captionCtx = (require as any).context("../captions", false, /\.json$/);
const captions: Record<string, CaptionWord[]> = Object.fromEntries(
  captionCtx.keys().map((key: string) => [key.replace(/^\.\/|\.json$/g, ""), captionCtx(key)]),
);

const fontsReady = delayRender("Loading fonts");
Promise.all([
  ...[400, 700, 900].map((w) => document.fonts.load(`${w} 1em "Passion One"`)),
  ...[700, 800, 900].map((w) => document.fonts.load(`${w} 1em Nunito`)),
])
  .catch(() => undefined)
  .then(() => continueRender(fontsReady));

const formats = [
  { suffix: "short", width: 1080, height: 1920 }, // Instagram Reels / YouTube Shorts
  { suffix: "long", width: 1920, height: 1080 }, // regular YouTube
] as const;

export const Root: React.FC = () => (
  <>
    {episodes.map((episode) => (
      <Folder key={episode.id} name={episode.id}>
        {formats.map((f) => (
          <Composition
            key={f.suffix}
            id={`${episode.id}-${f.suffix}`}
            component={EpisodeVideo}
            defaultProps={{ episode, words: captions[episode.id] }}
            durationInFrames={episodeFrames(episode)}
            fps={FPS}
            width={f.width}
            height={f.height}
          />
        ))}
      </Folder>
    ))}
  </>
);
