import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** 0 → 1 spring that starts `delay` seconds into the scene. */
export const useEnter = (delay = 0, damping = 16) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay * fps, fps, config: { damping, mass: 0.7 } });
};

/** Slide-up + fade entrance. */
export const Rise: React.FC<{
  delay?: number;
  distance?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, distance = 60, style, children }) => {
  const p = useEnter(delay);
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - p) * distance}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Scale-in with a little overshoot, for icons and badges. */
export const Pop: React.FC<{
  delay?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, style, children }) => {
  const p = useEnter(delay, 9);
  return <div style={{ transform: `scale(${p})`, ...style }}>{children}</div>;
};
