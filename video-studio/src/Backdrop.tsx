import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { useLayout, useTheme } from "./theme";

/** Flat studio backdrop: soft vignette plus a perspective grid floor below the horizon. */
export const Backdrop: React.FC = () => {
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  const { horizon, u } = useLayout();
  const cx = width / 2;
  const floor = height - horizon;

  const rows = Array.from({ length: 12 }, (_, i) => horizon + floor * Math.pow((i + 1) / 12, 1.9));
  const spokes = Array.from({ length: 31 }, (_, i) => cx + (i - 15) * 150 * u);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 42%, ${theme.bg} 35%, ${theme.bgEdge} 100%)`,
      }}
    >
      <svg width={width} height={height}>
        <defs>
          <linearGradient id="floor-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.12" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="floor-mask">
            <rect x={0} y={horizon} width={width} height={floor} fill="url(#floor-fade)" />
          </mask>
        </defs>
        <g mask="url(#floor-mask)" stroke={theme.grid} strokeWidth={2 * u} fill="none">
          <line x1={0} y1={horizon} x2={width} y2={horizon} />
          {rows.map((y) => (
            <line key={y} x1={0} y1={y} x2={width} y2={y} />
          ))}
          {spokes.map((x) => (
            <line key={x} x1={cx + (x - cx) * 0.42} y1={horizon} x2={cx + (x - cx) * 3.2} y2={height} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
