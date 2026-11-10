import React from "react";
import { BODY, DISPLAY, useTheme } from "./theme";
import type { Tone } from "./types";

/**
 * Flat-vector building blocks for stages. All are SVG, drawn on the 1000x900 stage canvas,
 * and positioned by the point where they touch the floor (`x` = left edge, `ground` = y).
 * `grow` (0-1) raises an object out of the floor, so pass it a beat's `enter()`.
 */

type BoxColors = { front: string; side: string; top: string };

/** Soft contact shadow so objects sit on the floor. */
export const Shadow: React.FC<{ x: number; ground: number; w: number; opacity?: number }> = ({
  x,
  ground,
  w,
  opacity = 1,
}) => {
  const theme = useTheme();
  return (
    <ellipse cx={x + w * 0.6} cy={ground + 6} rx={w * 0.72} ry={w * 0.09} fill={theme.shadow} opacity={opacity} />
  );
};

/** A block with a front, a darker right side and a lighter top. */
export const Box: React.FC<{
  x: number;
  ground: number;
  w: number;
  h: number;
  depth?: number;
  colors: BoxColors;
  grow?: number;
  shadow?: boolean;
  children?: React.ReactNode;
}> = ({ x, ground, w, h, depth = w * 0.28, colors, grow = 1, shadow = true, children }) => {
  const hh = h * Math.max(grow, 0);
  const top = ground - hh;
  const dx = depth;
  const dy = depth * 0.45;
  if (hh < 1) return null;
  return (
    <g>
      {shadow ? <Shadow x={x} ground={ground} w={w} opacity={Math.min(grow, 1)} /> : null}
      <polygon
        points={`${x + w},${top} ${x + w + dx},${top - dy} ${x + w + dx},${ground - dy} ${x + w},${ground}`}
        fill={colors.side}
      />
      <polygon
        points={`${x},${top} ${x + dx},${top - dy} ${x + w + dx},${top - dy} ${x + w},${top}`}
        fill={colors.top}
      />
      <rect x={x} y={top} width={w} height={hh} fill={colors.front} />
      {children}
    </g>
  );
};

/** Tower block with a window grid. `lit` (0-1) is the share of windows glowing accent. */
export const Building: React.FC<{
  x: number;
  ground: number;
  w: number;
  h: number;
  rows?: number;
  cols?: number;
  lit?: number;
  /** Height of the accent band at the bottom (the "paid off" part in the reference). */
  base?: number;
  grow?: number;
}> = ({ x, ground, w, h, rows = 6, cols = 3, lit = 0, base = 0, grow = 1 }) => {
  const theme = useTheme();
  const hh = h * Math.max(grow, 0);
  const top = ground - hh;
  const pad = w * 0.14;
  const cell = (w - pad * 2) / cols;
  const win = cell * 0.52;
  const bodyH = h - base - pad;
  const rowH = bodyH / rows;
  const windows = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const y = ground - h + pad + r * rowH;
      if (y < top) continue;
      // Stable pseudo-random order so the same windows light up every frame.
      const order = ((r * 7 + c * 13 + 5) % (rows * cols)) / (rows * cols);
      windows.push(
        <rect
          key={`${r}-${c}`}
          x={x + pad + c * cell + (cell - win) / 2}
          y={y}
          width={win}
          height={win}
          fill={order < lit ? theme.accent : theme.slateLight}
        />,
      );
    }
  }
  return (
    <Box
      x={x}
      ground={ground}
      w={w}
      h={h}
      grow={grow}
      colors={{ front: theme.slate, side: theme.slateDark, top: theme.slateLight }}
    >
      {base > 0 && hh > 0 ? (
        <>
          <rect x={x} y={ground - Math.min(base, hh)} width={w} height={Math.min(base, hh)} fill={theme.accent} />
          <polygon
            points={`${x + w},${ground - Math.min(base, hh)} ${x + w + w * 0.28},${ground - Math.min(base, hh) - w * 0.126} ${x + w + w * 0.28},${ground - w * 0.126} ${x + w},${ground}`}
            fill={theme.accentDeep}
          />
        </>
      ) : null}
      {windows}
    </Box>
  );
};

/** Small house: a block with a pitched roof. */
export const House: React.FC<{
  x: number;
  ground: number;
  w: number;
  h: number;
  grow?: number;
}> = ({ x, ground, w, h, grow = 1 }) => {
  const theme = useTheme();
  const depth = w * 0.28;
  const top = ground - h * grow;
  const roof = w * 0.42 * grow;
  return (
    <g>
      <Box
        x={x}
        ground={ground}
        w={w}
        h={h}
        depth={depth}
        grow={grow}
        colors={{ front: theme.slate, side: theme.slateDark, top: theme.slateDark }}
      />
      {grow > 0.05 ? (
        <>
          <polygon
            points={`${x + w / 2},${top - roof} ${x + w / 2 + depth},${top - roof - depth * 0.45} ${x + w + depth + 8},${top - depth * 0.45} ${x + w + 8},${top}`}
            fill={theme.slateDark}
          />
          <polygon points={`${x - 8},${top} ${x + w / 2},${top - roof} ${x + w + 8},${top}`} fill={theme.slateLight} />
          <rect x={x + w * 0.38} y={ground - h * 0.5 * grow} width={w * 0.24} height={h * 0.5 * grow} fill={theme.slateDark} />
        </>
      ) : null}
    </g>
  );
};

/** Simple standing figure. `x` is its centre. */
export const Person: React.FC<{
  x: number;
  ground: number;
  h?: number;
  color?: string;
  hat?: boolean;
  opacity?: number;
}> = ({ x, ground, h = 150, color, hat = false, opacity = 1 }) => {
  const theme = useTheme();
  const fill = color ?? theme.ink;
  const head = h * 0.13;
  const bodyW = h * 0.3;
  const shoulder = ground - h + head * 2 + h * 0.03;
  const hip = ground - h * 0.42;
  return (
    <g opacity={opacity}>
      <ellipse cx={x} cy={ground + 4} rx={bodyW * 0.8} ry={h * 0.035} fill={theme.shadow} />
      <rect x={x - bodyW * 0.42} y={hip - 4} width={bodyW * 0.36} height={ground - hip + 4} rx={bodyW * 0.14} fill={fill} />
      <rect x={x + bodyW * 0.06} y={hip - 4} width={bodyW * 0.36} height={ground - hip + 4} rx={bodyW * 0.14} fill={fill} />
      <rect x={x - bodyW / 2} y={shoulder} width={bodyW} height={hip - shoulder + 6} rx={bodyW * 0.3} fill={fill} />
      <circle cx={x} cy={ground - h + head} r={head} fill={fill} />
      {hat ? (
        <>
          <rect x={x - head * 1.6} y={ground - h + head * 0.2} width={head * 3.2} height={head * 0.34} rx={head * 0.17} fill={fill} />
          <rect x={x - head * 0.95} y={ground - h - head * 0.75} width={head * 1.9} height={head * 1.1} rx={head * 0.2} fill={fill} />
        </>
      ) : null}
    </g>
  );
};

/** Label pill. `x`,`y` are its centre. Scale it with a beat's `enter()` to pop it in. */
export const Tag: React.FC<{
  x: number;
  y: number;
  text: string;
  tone?: Tone;
  size?: number;
  scale?: number;
  rotate?: number;
  display?: boolean;
}> = ({ x, y, text, tone = "dark", size = 26, scale = 1, rotate = 0, display = false }) => {
  const theme = useTheme();
  if (scale <= 0.01) return null;
  const bg = tone === "accent" ? theme.accent : tone === "alert" ? theme.alert : theme.pill;
  const fg = tone === "accent" ? theme.onAccent : theme.pillText;
  const w = text.length * size * (display ? 0.5 : 0.62) + size * 1.3;
  const h = size * 1.75;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={display ? h * 0.3 : h / 2}
        fill={bg}
        stroke={tone === "dark" ? theme.pillBorder : "none"}
        strokeWidth={2}
      />
      <text
        x={0}
        y={size * (display ? 0.36 : 0.34)}
        textAnchor="middle"
        fontFamily={display ? DISPLAY : BODY}
        fontWeight={display ? 700 : 900}
        fontSize={display ? size * 1.15 : size}
        fill={fg}
      >
        {text}
      </text>
    </g>
  );
};

const quad = (a: [number, number], c: [number, number], b: [number, number], t: number) => {
  const m = 1 - t;
  return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]];
};

/** Dashed curved arrow that draws itself as `progress` goes 0 -> 1. */
export const DashedArrow: React.FC<{
  from: [number, number];
  to: [number, number];
  bend?: number;
  progress?: number;
  color?: string;
  width?: number;
}> = ({ from, to, bend = -120, progress = 1, color, width = 6 }) => {
  const theme = useTheme();
  if (progress <= 0.02) return null;
  const stroke = color ?? theme.ink;
  const ctrl: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + bend];
  const steps = Math.max(2, Math.round(40 * progress));
  const pts = Array.from({ length: steps + 1 }, (_, i) => quad(from, ctrl, to, (i / steps) * progress));
  const tip = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const angle = (Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) * 180) / Math.PI;
  return (
    <g>
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={`${width * 2.4} ${width * 1.8}`}
        strokeLinecap="round"
      />
      <polygon
        points={`0,0 ${-width * 3.6},${-width * 2} ${-width * 3.6},${width * 2}`}
        fill={stroke}
        transform={`translate(${tip[0]} ${tip[1]}) rotate(${angle})`}
      />
    </g>
  );
};

/** Sine wave from x=0 to x=`length`; wrap it in a rotated <g> to aim it. */
export const Wave: React.FC<{
  length: number;
  wavelength: number;
  amp: number;
  color: string;
  phase?: number;
  width?: number;
  opacity?: number;
}> = ({ length, wavelength, amp, color, phase = 0, width = 9, opacity = 1 }) => {
  if (length <= 2 || opacity <= 0.01) return null;
  const n = Math.max(2, Math.ceil(length / 5));
  const d = Array.from({ length: n + 1 }, (_, i) => {
    const x = (i / n) * length;
    const y = Math.sin((x / wavelength) * Math.PI * 2 - phase) * amp;
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} />;
};

/** Stack of flat notes or coins, for money moving around a scene. `x`,`y` = centre. */
export const Cash: React.FC<{ x: number; y: number; size?: number; opacity?: number }> = ({
  x,
  y,
  size = 44,
  opacity = 1,
}) => {
  const theme = useTheme();
  return (
    <g opacity={opacity}>
      <rect x={x - size / 2} y={y - size * 0.1} width={size} height={size * 0.5} rx={4} fill={theme.accentDeep} />
      <rect x={x - size / 2} y={y - size * 0.3} width={size} height={size * 0.5} rx={4} fill={theme.accent} />
      <circle cx={x} cy={y - size * 0.05} r={size * 0.12} fill={theme.accentDeep} />
    </g>
  );
};
