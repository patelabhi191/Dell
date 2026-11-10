import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop } from "./Backdrop";
import { BeatsContext } from "./beats";
import { Captions, type CaptionWord } from "./Captions";
import { Progress } from "./Progress";
import { SceneView } from "./scenes";
import { stages } from "./stages";
import { BODY, STAGE, ThemeContext, themes, useLayout, useTheme } from "./theme";
import type { Episode } from "./types";

export const FPS = 30;
const FADE = 7; // frames of fade at each end of a scene
const STAGE_DIM = 0.14; // stage opacity behind scenes that are not "show"

export const sceneFrames = (seconds: number) => Math.round(seconds * FPS);
export const episodeFrames = (episode: Episode) =>
  episode.scenes.reduce((sum, s) => sum + sceneFrames(s.seconds), 0);

const SceneFade: React.FC<{ frames: number; last: boolean; children: React.ReactNode }> = ({
  frames,
  last,
  children,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = last
    ? 1
    : interpolate(frame, [frames - FADE, frames], [1, 0], { extrapolateLeft: "clamp" });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};

/** Scales the 1000x900 stage canvas into its zone on screen. */
const StageLayer: React.FC<{ name: string; opacity: number }> = ({ name, opacity }) => {
  const { stage } = useLayout();
  const Stage = stages[name];
  if (!Stage) throw new Error(`Unknown stage "${name}". Register it in src/stages/index.ts`);
  return (
    <svg
      width={STAGE.width * stage.scale}
      height={STAGE.height * stage.scale}
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      style={{ position: "absolute", left: stage.x, top: stage.y, overflow: "visible", opacity }}
    >
      <Stage />
    </svg>
  );
};

const Handle: React.FC<{ text: string }> = ({ text }) => {
  const { u, captionCenter } = useLayout();
  const theme = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: captionCenter + 62 * u,
        textAlign: "center",
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: 26 * u,
        color: theme.muted,
      }}
    >
      {text}
    </div>
  );
};

export const EpisodeVideo: React.FC<{ episode: Episode; words?: CaptionWord[] }> = ({
  episode,
  words,
}) => {
  const frame = useCurrentFrame();
  const theme = themes[episode.theme ?? (episode.format === "story" ? "night" : "light")];

  let cursor = 0;
  const timeline = episode.scenes.map((scene) => {
    const start = cursor;
    cursor += sceneFrames(scene.seconds);
    return { scene, start, frames: cursor - start };
  });
  const beats: Record<string, number> = {};
  for (const { scene, start } of timeline) if (scene.beat) beats[scene.beat] = start;

  const index = Math.max(0, timeline.findIndex((s) => frame < s.start + s.frames));
  const current = timeline[index];
  const previous = timeline[index - 1];
  const local = frame - current.start;
  const blend = interpolate(local, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const stageLevel = (s?: (typeof timeline)[number]) => (!s || s.scene.type === "show" ? 1 : STAGE_DIM);
  const stageOpacity = stageLevel(previous) + (stageLevel(current) - stageLevel(previous)) * blend;
  const progressOpacity = previous?.scene.progress ? 1 : blend;

  return (
    <ThemeContext.Provider value={theme}>
      <BeatsContext.Provider value={beats}>
        <Backdrop />
        {episode.stage ? <StageLayer name={episode.stage} opacity={stageOpacity} /> : null}
        {timeline.map(({ scene, start, frames }, i) => (
          <Sequence key={i} from={start} durationInFrames={frames}>
            <SceneFade frames={frames} last={i === timeline.length - 1}>
              <SceneView scene={scene} />
            </SceneFade>
          </Sequence>
        ))}
        {current.scene.progress ? (
          <Progress value={current.scene.progress} opacity={progressOpacity} />
        ) : null}
        {words && episode.captions ? <Captions words={words} /> : null}
        {episode.handle ? <Handle text={episode.handle} /> : null}
        {episode.voiceover ? <Audio src={staticFile(`audio/${episode.voiceover}`)} /> : null}
        {episode.music ? (
          <Audio src={staticFile(`audio/${episode.music}`)} volume={episode.musicVolume} loop />
        ) : null}
      </BeatsContext.Provider>
    </ThemeContext.Provider>
  );
};
