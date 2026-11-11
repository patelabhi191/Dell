import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout, useTheme } from "./theme";

/**
 * Flat studio backdrop: soft vignette, a perspective grid floor that glides toward the
 * viewer, and a few small shapes drifting upward so the frame is never completely still.
 */
export const Backdrop: React.FC = () => {
  const theme = useTheme();
  const { width, height, fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const { horizon, u } = useLayout();
  const cx = width / 2;
  const floor = height - horizon;

  const glide = (t * 0.22) % 1;
  const rows = Array.from({ length: 13 }, (_, i) => horizon + floor * Math.pow((i + glide) / 12, 1.9));
  const motes = Array.from({ length: 16 }, (_, i) => {
    const r = (k: string) => random(`mote-${i}-${k}`);
    const travel = height * 0.9;
    const y = height * 0.95 - ((r("y") * travel + t * (18 + r("v") * 30) * u) % travel);
    const x = r("x") * width + Math.sin(t * 0.6 + i) * 18 * u;
    const fade = Math.sin(((height * 0.95 - y) / travel) * Math.PI);
    return { x, y, size: (7 + r("s") * 9) * u, kind: i % 3, spin: t * 25 * (i % 2 ? 1 : -1) + i * 40, fade, accent: i % 4 === 0 };
  });
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
        {motes.map((m, i) => {
          const color = m.accent ? theme.accent : theme.slateLight;
          const common = { opacity: m.fade * (m.accent ? 0.5 : 0.35) };
          if (m.kind === 0) return <circle key={i} cx={m.x} cy={m.y} r={m.size / 2} fill={color} {...common} />;
          if (m.kind === 1)
            return (
              <rect key={i} x={m.x - m.size / 2} y={m.y - m.size / 2} width={m.size} height={m.size} rx={m.size * 0.2} fill={color} transform={`rotate(${m.spin} ${m.x} ${m.y})`} {...common} />
            );
          return (
            <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.spin})`} stroke={color} strokeWidth={m.size * 0.28} strokeLinecap="round" {...common}>
              <line x1={-m.size / 2} y1={0} x2={m.size / 2} y2={0} />
              <line x1={0} y1={-m.size / 2} x2={0} y2={m.size / 2} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
