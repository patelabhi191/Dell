import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "./theme";

/** Slowly drifting flat shapes. `seed` keeps each episode's layout stable but unique. */
export const Background: React.FC<{ seed: string }> = ({ seed }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const short = Math.min(width, height);

  const shapes = Array.from({ length: 9 }, (_, i) => {
    const r = (k: string) => random(`${seed}-${i}-${k}`);
    const size = short * (0.08 + r("s") * 0.22);
    const x = r("x") * width + Math.sin(t * (0.1 + r("fx") * 0.2) + i) * short * 0.04;
    const y = r("y") * height + Math.cos(t * (0.1 + r("fy") * 0.2) + i) * short * 0.04;
    const color = theme.palette[i % theme.palette.length];
    const kind = i % 3;
    const common = { fill: color, opacity: 0.1 };
    if (kind === 0) return <circle key={i} cx={x} cy={y} r={size / 2} {...common} />;
    if (kind === 1)
      return (
        <rect
          key={i}
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          rx={size * 0.18}
          transform={`rotate(${r("rot") * 90 + t * 4} ${x} ${y})`}
          {...common}
        />
      );
    return (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={size / 2}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.12}
        opacity={0.12}
      />
    );
  });

  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(160deg, ${theme.bg} 0%, ${theme.bgAlt} 100%)` }}
    >
      <svg width={width} height={height}>
        {shapes}
      </svg>
    </AbsoluteFill>
  );
};
