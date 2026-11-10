import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import { SceneView } from "./scenes";
import { ThemeContext, themes, useTheme } from "./theme";
import type { Episode } from "./types";

export const FPS = 30;
const FADE = 8; // frames of fade at each end of a scene

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

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const theme = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        height: height * 0.006,
        width: `${((frame + 1) / durationInFrames) * 100}%`,
        background: theme.accent,
      }}
    />
  );
};

export const EpisodeVideo: React.FC<{ episode: Episode }> = ({ episode }) => {
  const theme = themes[episode.theme] ?? themes.midnight;
  let from = 0;
  return (
    <ThemeContext.Provider value={theme}>
      <Background seed={episode.id} />
      {episode.scenes.map((scene, i) => {
        const frames = sceneFrames(scene.seconds);
        const start = from;
        from += frames;
        return (
          <Sequence key={i} from={start} durationInFrames={frames}>
            <SceneFade frames={frames} last={i === episode.scenes.length - 1}>
              <SceneView scene={scene} />
            </SceneFade>
          </Sequence>
        );
      })}
      <ProgressBar />
      {episode.voiceover ? <Audio src={staticFile(`audio/${episode.voiceover}`)} /> : null}
      {episode.music ? (
        <Audio src={staticFile(`audio/${episode.music}`)} volume={episode.musicVolume} loop />
      ) : null}
    </ThemeContext.Provider>
  );
};
