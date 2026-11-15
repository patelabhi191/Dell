import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop } from "./Backdrop";
import { BeatsContext } from "./beats";
import { Captions, type CaptionWord } from "./Captions";
import { StillContext } from "./motion";
import { Pill, Rich, SceneView } from "./scenes";
import { stages } from "./stages";
import { DISPLAY, STAGE, ThemeContext, themes, useLayout } from "./theme";
import type { Episode } from "./types";

export const FPS = 30;
const FADE = 7; // frames of fade at each end of a scene
const STAGE_DIM = 0.14; // stage opacity behind scenes that are not "show"

export const sceneFrames = (seconds: number) => Math.round(seconds * FPS);
export const episodeFrames = (episode: Episode) =>
  episode.scenes.reduce((sum, s) => sum + sceneFrames(s.seconds), 0);

/**
 * How each scene's text arrives. Consecutive scenes never enter the same way, so every
 * slide feels new (see PLAYBOOK.md, "Doom-scroll animation").
 */
const ENTRANCES = [
  (p: number) => `translateX(${(1 - p) * 14}%)`,
  (p: number) => `scale(${0.6 + 0.4 * p})`,
  (p: number) => `translateY(${-(1 - p) * 12}%)`,
  (p: number) => `translateX(${-(1 - p) * 14}%)`,
  (p: number) => `rotate(${(1 - p) * -9}deg) scale(${0.8 + 0.2 * p})`,
  (p: number) => `translateY(${(1 - p) * 10}%) scale(${0.9 + 0.1 * p})`,
];

const SceneFade: React.FC<{
  frames: number;
  first: boolean;
  last: boolean;
  index: number;
  children: React.ReactNode;
}> = ({
  frames,
  first,
  last,
  index,
  children,
}) => {
  const frame = useCurrentFrame();
  const enter = first ? 1 : spring({ frame, fps: FPS, config: { damping: 12, mass: 0.6 } });
  const transform = first ? undefined : ENTRANCES[index % ENTRANCES.length](enter);
  // The very first frame must already be full: it is what a scrolling viewer sees.
  const fadeIn = first ? 1 : interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = last
    ? 1
    : interpolate(frame, [frames - FADE, frames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut), transform }}>
      <StillContext.Provider value={first}>{children}</StillContext.Provider>
    </AbsoluteFill>
  );
};

/** Scales the 1000x900 stage canvas into its zone on screen. */
const StageLayer: React.FC<{
  name: string;
  opacity: number;
  zoom: number;
  place?: { x: number; y: number; scale: number };
}> = ({ name, opacity, zoom, place }) => {
  const layout = useLayout();
  const stage = place ?? layout.stage;
  const Stage = stages[name];
  if (!Stage) throw new Error(`Unknown stage "${name}". Register it in src/stages/index.ts`);
  return (
    <svg
      width={STAGE.width * stage.scale}
      height={STAGE.height * stage.scale}
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      style={{
        position: "absolute",
        left: stage.x,
        top: stage.y,
        overflow: "visible",
        opacity,
        transform: `scale(${zoom})`,
        transformOrigin: "50% 70%",
      }}
    >
      <Stage />
    </svg>
  );
};

const themeOf = (episode: Episode) => themes[episode.theme ?? (episode.format === "story" ? "night" : "light")];

/** Scene start frames and beat frames (including word cues) for an episode. */
const buildTimeline = (episode: Episode, words?: CaptionWord[]) => {
  let cursor = 0;
  const timeline = episode.scenes.map((scene) => {
    const start = cursor;
    cursor += sceneFrames(scene.seconds);
    return { scene, start, frames: cursor - start };
  });
  const beats: Record<string, number> = {};
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
  for (const { scene, start, frames } of timeline) {
    if (scene.beat) beats[scene.beat] = start;
    // Cues land on the frame the voice says their word, found in the caption timings.
    for (const [name, word] of Object.entries(scene.cues ?? {})) {
      const hit = words?.find(
        (w) =>
          w.start * FPS >= start - 3 &&
          w.start * FPS < start + frames &&
          clean(w.text) === clean(word),
      );
      beats[name] = hit ? Math.round(hit.start * FPS) : start;
    }
  }
  return { timeline, beats };
};

/** Reel cover: the stage frozen at one moment, with a big title. Safe for 4:5 and 3:4 crops. */
export const Thumbnail: React.FC<{ episode: Episode; words?: CaptionWord[]; name: string }> = ({
  episode,
  words,
  name,
}) => {
  const theme = themeOf(episode);
  const { beats } = buildTimeline(episode, words);
  const thumb = episode.thumbnails.find((th) => th.name === name);
  const { u, width } = useLayout();
  if (!thumb) throw new Error(`${episode.id} has no thumbnail named "${name}"`);
  if (thumb.at === "cover") beats.cover = 0;
  if (beats[thumb.at] === undefined) throw new Error(`Thumbnail beat "${thumb.at}" is not in ${episode.id}`);
  const at = Math.round(beats[thumb.at] + thumb.offset * FPS);
  // Shift every beat back by `at`, so frame 0 of this still shows the stage at that moment.
  const shifted = Object.fromEntries(Object.entries(beats).map(([k, v]) => [k, v - at]));
  const scale = 0.94 * u;
  return (
    <ThemeContext.Provider value={theme}>
      <BeatsContext.Provider value={shifted}>
        <>
          <Backdrop />
          {episode.stage ? (
            <StageLayer
              name={episode.stage}
              opacity={1}
              zoom={1}
              place={{ x: (width - STAGE.width * scale) / 2, y: 760 * u, scale }}
            />
          ) : null}
        </>
        <AbsoluteFill
          style={{
            padding: `${300 * u}px ${80 * u}px 0`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26 * u,
            textAlign: "center",
          }}
        >
          {thumb.tag ? <Pill tone="accent" size={40}>{thumb.tag}</Pill> : null}
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 900,
              // Long titles get smaller so the picture still shows under them.
              fontSize: (thumb.title.replace(/\*/g, "").length > 24 ? 138 : 168) * u,
              lineHeight: 0.92,
              textTransform: "uppercase",
              color: theme.ink,
              textWrap: "balance",
            }}
          >
            <Rich text={thumb.title} />
          </div>
        </AbsoluteFill>
      </BeatsContext.Provider>
    </ThemeContext.Provider>
  );
};

export const EpisodeVideo: React.FC<{ episode: Episode; words?: CaptionWord[] }> = ({
  episode,
  words,
}) => {
  const frame = useCurrentFrame();
  const theme = themeOf(episode);
  const { timeline, beats } = buildTimeline(episode, words);

  const index = Math.max(0, timeline.findIndex((s) => frame < s.start + s.frames));
  const current = timeline[index];
  const previous = timeline[index - 1];
  const local = frame - current.start;
  const blend = interpolate(local, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const stageLevel = (s?: (typeof timeline)[number]) => {
    if (!s) return 1;
    if (s.scene.stage) return s.scene.stage === "full" ? 1 : STAGE_DIM;
    return s.scene.type === "show" ? 1 : STAGE_DIM;
  };
  const stageOpacity = stageLevel(previous) + (stageLevel(current) - stageLevel(previous)) * blend;
  // Camera: a small punch-in on every cut, then a slow push through the scene.
  const zoom = 1 + 0.05 * (1 - blend) * (index > 0 ? 1 : 0) + 0.04 * (local / current.frames);

  return (
    <ThemeContext.Provider value={theme}>
      <BeatsContext.Provider value={beats}>
        <Backdrop />
        {episode.stage ? <StageLayer name={episode.stage} opacity={stageOpacity} zoom={zoom} /> : null}
        {timeline.map(({ scene, start, frames }, i) => (
          <Sequence key={i} from={start} durationInFrames={frames}>
            <SceneFade frames={frames} index={i} first={i === 0} last={i === timeline.length - 1}>
              <SceneView scene={scene} handle={episode.handle} />
            </SceneFade>
          </Sequence>
        ))}
        {words && episode.captions ? <Captions words={words} keywords={episode.keywords} /> : null}
        {episode.voiceover ? <Audio src={staticFile(`audio/${episode.voiceover}`)} /> : null}
        {episode.music ? (
          <Audio src={staticFile(`audio/${episode.music}`)} volume={episode.musicVolume} loop />
        ) : null}
      </BeatsContext.Provider>
    </ThemeContext.Provider>
  );
};
