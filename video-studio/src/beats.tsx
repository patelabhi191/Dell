import { createContext, useContext } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Beat name -> frame it starts on. Filled in from each scene's "beat" field. */
export const BeatsContext = createContext<Record<string, number>>({});

/**
 * Timing for stage animations. A beat starts when the scene that names it starts, so
 * animations stay in sync however long the voiceover makes each scene.
 *
 *   const waves = useBeat("waves");
 *   waves.on          // has the beat started?
 *   waves.t           // seconds since it started (negative before)
 *   waves.enter(0.3)  // 0 -> 1 spring, starting 0.3s into the beat
 *   waves.ramp(0, 2)  // 0 -> 1 linear between 0s and 2s into the beat
 */
export const useBeat = (name: string) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = useContext(BeatsContext)[name];
  const local = start === undefined ? -1 : frame - start;
  return {
    on: local >= 0,
    t: local / fps,
    enter: (delay = 0, damping = 14) =>
      local < 0 ? 0 : spring({ frame: local - delay * fps, fps, config: { damping, mass: 0.7 } }),
    ramp: (from: number, to: number) =>
      interpolate(local / fps, [from, to], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
  };
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
