import React from "react";
import { BODY, DISPLAY } from "../theme";

/**
 * Full-screen explainer kit, modelled on the reference reels (PLAYBOOK.md, "Reference base").
 * Everything draws in SVG on the 1080x1920 frame. Put <KitDefs /> once inside each <svg>.
 *
 * Look: dark navy world filled edge to edge, lit objects, neon cyan for "how it works",
 * red for problems, amber for warnings, green for OK. Labels are small, uppercase, pinned to
 * the thing they name.
 */

export const K = {
  bg: "#070B14",
  bg2: "#0D1424",
  floor: "#111A2E",
  line: "#1E2B47",
  cyan: "#2ED3FF",
  cyanDeep: "#0E7EA8",
  red: "#FF4D5E",
  amber: "#FFB23F",
  green: "#3BE38B",
  white: "#F2F6FF",
  muted: "#7E8BA8",
  panel: "rgba(9,14,28,0.88)",
};
export const MONO = '"DejaVu Sans Mono", "Courier New", monospace';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Glow filters. ids: kglow (soft), kglow2 (wide). */
export const KitDefs: React.FC = () => (
  <defs>
    <filter id="kglow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="kglow2" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="14" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <radialGradient id="kvignette" cx="50%" cy="48%" r="72%">
      <stop offset="60%" stopColor="#000" stopOpacity="0" />
      <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
    </radialGradient>
    <radialGradient id="kglobe" cx="38%" cy="32%" r="75%">
      <stop offset="0%" stopColor="#3C7DD9" />
      <stop offset="55%" stopColor="#173E86" />
      <stop offset="100%" stopColor="#081A3F" />
    </radialGradient>
  </defs>
);

// ---------------------------------------------------------------- isometric world

/** Isometric projector: world units (x right-down, y left-down, z up) to screen. */
export const isoAt = (ox: number, oy: number, s = 1) => (x: number, y: number, z = 0) =>
  [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s] as const;

/** Full-bleed isometric floor grid that scrolls with `t`. */
export const IsoFloor: React.FC<{ t?: number; color?: string; opacity?: number }> = ({ t = 0, color = K.line, opacity = 1 }) => {
  const shift = (t * 30) % 60;
  return (
    <g opacity={opacity}>
      <rect x={0} y={0} width={1080} height={1920} fill={K.bg} />
      {Array.from({ length: 70 }, (_, i) => {
        const c = -1400 + i * 60 + shift;
        return (
          <g key={i} stroke={color} strokeWidth={2}>
            <line x1={c} y1={0} x2={c + 1920 * 1.732} y2={1920} />
            <line x1={c + 2200} y1={0} x2={c + 2200 - 1920 * 1.732} y2={1920} />
          </g>
        );
      })}
    </g>
  );
};

/** Lit isometric box. `x,y,z` is the near-bottom corner in world units. */
export const IsoBox: React.FC<{
  at: ReturnType<typeof isoAt>;
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  top?: string;
  left?: string;
  right?: string;
  edge?: string;
  children?: React.ReactNode;
}> = ({ at, x, y, z = 0, w, d, h, top = "#2A3A5E", left = "#1A2642", right = "#141E36", edge, children }) => {
  const p = (a: number, b: number, c: number) => at(a, b, c).join(",");
  return (
    <g>
      <polygon points={[p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)].join(" ")} fill={left} />
      <polygon points={[p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)].join(" ")} fill={right} />
      <polygon points={[p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)].join(" ")} fill={top} stroke={edge} strokeWidth={edge ? 2 : 0} />
      {children}
    </g>
  );
};

/** Server rack: tall iso box with rows of status lights. `state` colours the lights. */
export const ServerRack: React.FC<{
  at: ReturnType<typeof isoAt>;
  x: number;
  y: number;
  t: number;
  state?: "ok" | "busy" | "fail" | "off";
  h?: number;
}> = ({ at, x, y, t, state = "ok", h = 120 }) => {
  const color = state === "fail" ? K.red : state === "busy" ? K.amber : state === "off" ? "#2A3350" : K.cyan;
  const rows = Math.floor(h / 14);
  return (
    <IsoBox at={at} x={x} y={y} w={22} d={40} h={h} top="#22314F" left="#121B31" right="#0E1528">
      {Array.from({ length: rows }, (_, r) => {
        const on = state === "off" ? false : Math.sin(t * (state === "fail" ? 14 : 4) + r * 1.7 + x * 0.1) > -0.4;
        const [ax, ay] = at(x, y + 40, 10 + r * 14);
        const [bx, by] = at(x + 18, y + 40, 10 + r * 14);
        return <line key={r} x1={ax + 3} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={on ? 1 : 0.25} filter="url(#kglow)" />;
      })}
    </IsoBox>
  );
};

/** Voxel tree. */
export const IsoTree: React.FC<{ at: ReturnType<typeof isoAt>; x: number; y: number; s?: number }> = ({ at, x, y, s = 1 }) => (
  <g>
    <IsoBox at={at} x={x + 6 * s} y={y + 6 * s} w={6 * s} d={6 * s} h={14 * s} top="#4A3A2A" left="#3A2C1F" right="#2E2318" />
    <IsoBox at={at} x={x} y={y} z={14 * s} w={18 * s} d={18 * s} h={14 * s} top="#2E6B4A" left="#1F4F36" right="#173D2A" />
    <IsoBox at={at} x={x + 3 * s} y={y + 3 * s} z={28 * s} w={12 * s} d={12 * s} h={12 * s} top="#357A55" left="#24583D" right="#1A4430" />
  </g>
);

/** Lit iso building with window grid. */
export const IsoBuilding: React.FC<{ at: ReturnType<typeof isoAt>; x: number; y: number; w: number; d: number; h: number; t: number; tint?: string }> = ({
  at,
  x,
  y,
  w,
  d,
  h,
  t,
  tint = "#FFD98A",
}) => (
  <IsoBox at={at} x={x} y={y} w={w} d={d} h={h} top="#1E2A46" left="#141D33" right="#0F1628">
    {Array.from({ length: Math.floor(h / 12) }, (_, r) =>
      Array.from({ length: Math.max(1, Math.floor(w / 9)) }, (_, c) => {
        const lit = Math.sin(r * 12.9 + c * 78.2 + x) > -0.1;
        const [px, py] = at(x + 4 + c * 9, y + d, 6 + r * 12);
        return lit ? <rect key={`${r}-${c}`} x={px} y={py - 5} width={5} height={6} fill={tint} opacity={0.65 + 0.35 * Math.sin(t * 2 + r + c)} /> : null;
      }),
    )}
  </IsoBox>
);

/** Voxel person (front-facing, iso-ish). */
export const VoxelPerson: React.FC<{ x: number; y: number; s?: number; shirt?: string }> = ({ x, y, s = 1, shirt = "#5B6B8C" }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={0} cy={2} rx={26} ry={8} fill="#000" opacity={0.4} />
    <rect x={-14} y={-40} width={12} height={40} fill="#2B3247" />
    <rect x={2} y={-40} width={12} height={40} fill="#232A3D" />
    <rect x={-18} y={-86} width={36} height={48} rx={4} fill={shirt} />
    <rect x={-13} y={-116} width={26} height={28} rx={4} fill="#C99A78" />
    <rect x={-14} y={-122} width={28} height={10} rx={3} fill="#3A2C22" />
  </g>
);

// ---------------------------------------------------------------- globe

const CITIES: [number, number][] = [
  [40.7, -74], [34, -118.2], [41.9, -87.6], [29.8, -95.4], [33.7, -84.4], [47.6, -122.3], [25.8, -80.2], [39.7, -105],
  [43.7, -79.4], [45.5, -73.6], [19.4, -99.1], [-23.5, -46.6], [-34.6, -58.4], [4.7, -74.1], [-12, -77], [51.5, -0.1],
  [48.9, 2.4], [52.5, 13.4], [40.4, -3.7], [41.9, 12.5], [55.8, 37.6], [59.3, 18.1], [30, 31.2], [6.5, 3.4],
  [-26.2, 28], [-1.3, 36.8], [25.2, 55.3], [24.7, 46.7], [28.6, 77.2], [19.1, 72.9], [13.1, 80.3], [23.8, 90.4],
  [13.8, 100.5], [1.35, 103.8], [-6.2, 106.8], [22.3, 114.2], [31.2, 121.5], [39.9, 116.4], [37.6, 127], [35.7, 139.7],
  [34.7, 135.5], [14.6, 121], [-33.9, 151.2], [-37.8, 145], [-36.8, 174.8], [61.2, -149.9], [21.3, -157.9], [64.1, -21.9],
];

/** Orthographic globe with graticule and glowing cities. `lon0` spins it. */
export const Globe: React.FC<{
  cx: number;
  cy: number;
  r: number;
  lon0: number;
  lat0?: number;
  t: number;
  hot?: [number, number];
  arcs?: number;
  arcColor?: string;
}> = ({ cx, cy, r, lon0, lat0 = 20, t, hot, arcs = 0, arcColor = K.cyan }) => {
  const rad = Math.PI / 180;
  const proj = (lat: number, lon: number) => {
    const φ = lat * rad;
    const λ = (lon - lon0) * rad;
    const φ0 = lat0 * rad;
    const vis = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
    return {
      x: cx + r * Math.cos(φ) * Math.sin(λ),
      y: cy - r * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ)),
      vis,
    };
  };
  const line = (pts: { x: number; y: number; vis: number }[]) =>
    pts.map((p, i) => `${i && pts[i - 1].vis > 0 ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const meridians = Array.from({ length: 12 }, (_, i) => Array.from({ length: 37 }, (_, k) => proj(-90 + k * 5, i * 30)).filter((p) => p.vis > 0));
  const parallels = [-60, -30, 0, 30, 60].map((lat) => Array.from({ length: 73 }, (_, k) => proj(lat, k * 5)).filter((p) => p.vis > 0));
  const hp = hot ? proj(hot[0], hot[1]) : null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.08} fill={K.cyan} opacity={0.12} filter="url(#kglow2)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#kglobe)" />
      {[...meridians, ...parallels].map((pts, i) => (pts.length > 1 ? <path key={i} d={line(pts)} fill="none" stroke="#7FB4FF" strokeWidth={1.5} opacity={0.18} /> : null))}
      <g filter="url(#kglow)">
        {CITIES.map(([la, lo], i) => {
          const p = proj(la, lo);
          if (p.vis <= 0.05) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={3 + (i % 3)} fill="#FFE7A8" opacity={(0.6 + 0.4 * Math.sin(t * 3 + i)) * Math.min(1, p.vis * 2)} />;
        })}
      </g>
      {hp && hp.vis > 0 && arcs > 0
        ? CITIES.slice(0, arcs).map(([la, lo], i) => {
            const p = proj(la, lo);
            if (p.vis <= 0) return null;
            const mx = (p.x + hp.x) / 2;
            const my = (p.y + hp.y) / 2;
            const lift = Math.hypot(p.x - hp.x, p.y - hp.y) * 0.35;
            const q = (t * 0.8 + i * 0.13) % 1;
            return (
              <g key={i}>
                <path d={`M${hp.x},${hp.y} Q${mx},${my - lift} ${p.x},${p.y}`} fill="none" stroke={arcColor} strokeWidth={2.5} opacity={0.55} filter="url(#kglow)" />
                <circle cx={(1 - q) * (1 - q) * hp.x + 2 * (1 - q) * q * mx + q * q * p.x} cy={(1 - q) * (1 - q) * hp.y + 2 * (1 - q) * q * (my - lift) + q * q * p.y} r={4} fill="#FFFFFF" />
              </g>
            );
          })
        : null}
      {hp && hp.vis > 0 ? <circle cx={hp.x} cy={hp.y} r={10 + Math.sin(t * 6) * 3} fill={arcColor} filter="url(#kglow2)" /> : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#9CC9FF" strokeWidth={3} opacity={0.5} />
    </g>
  );
};

// ---------------------------------------------------------------- labels & HUD

/** Small uppercase tag pinned to a point with a leader line. */
export const Callout: React.FC<{
  x: number;
  y: number;
  tx: number;
  ty: number;
  text: string;
  tone?: "cyan" | "red" | "amber" | "green" | "plain";
  s?: number;
  size?: number;
}> = ({ x, y, tx, ty, text, tone = "plain", s = 1, size = 22 }) => {
  if (s <= 0.01) return null;
  const c = tone === "cyan" ? K.cyan : tone === "red" ? K.red : tone === "amber" ? K.amber : tone === "green" ? K.green : K.white;
  const filled = tone !== "plain";
  const w = text.length * size * 0.62 + size * 1.2;
  return (
    <g opacity={clamp01(s)}>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke={c} strokeWidth={2} opacity={0.8} />
      <circle cx={x} cy={y} r={5} fill={c} filter="url(#kglow)" />
      <g transform={`translate(${tx} ${ty}) scale(${s})`}>
        <rect x={-w / 2} y={-size} width={w} height={size * 2} rx={size * 0.25} fill={filled ? c : K.panel} stroke={filled ? "none" : "rgba(255,255,255,0.55)"} strokeWidth={2} />
        <text x={0} y={size * 0.36} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={size} fill={filled ? "#081020" : K.white} letterSpacing={1}>
          {text}
        </text>
      </g>
    </g>
  );
};

/** Top status bar: an icon label plus segment lights, e.g. SERVERS ■■■■□□. */
export const StatusBar: React.FC<{ y?: number; label: string; states: ("ok" | "warn" | "fail" | "off")[]; right?: string; rightTone?: "cyan" | "red" | "amber" | "green" }> = ({
  y = 300,
  label,
  states,
  right,
  rightTone = "cyan",
}) => {
  const col = { ok: K.cyan, warn: K.amber, fail: K.red, off: "#26304A" } as const;
  const rc = { cyan: K.cyan, red: K.red, amber: K.amber, green: K.green }[rightTone];
  return (
    <g>
      <rect x={110} y={y - 26} width={160} height={52} rx={26} fill={K.panel} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
      <text x={190} y={y + 9} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={22} fill={K.white}>{label}</text>
      {states.map((st, i) => (
        <rect key={i} x={290 + i * 44} y={y - 16} width={34} height={32} rx={4} fill={col[st]} filter={st === "off" ? undefined : "url(#kglow)"} />
      ))}
      {right ? (
        <g>
          <circle cx={290 + states.length * 44 + 24} cy={y} r={7} fill={rc} filter="url(#kglow)" />
          <text x={290 + states.length * 44 + 40} y={y + 8} fontFamily={MONO} fontWeight={700} fontSize={22} fill={rc}>{right}</text>
        </g>
      ) : null}
    </g>
  );
};

/** Chapter tabs (SEND · SIGN · PACE ...). The active one is filled. */
export const ChapterTabs: React.FC<{ y?: number; chapters: string[]; active: number }> = ({ y = 300, chapters, active }) => {
  const w = Math.min(160, 860 / chapters.length);
  const x0 = 540 - (w * chapters.length) / 2;
  return (
    <g>
      {chapters.map((c, i) => (
        <g key={c} transform={`translate(${x0 + i * w} ${y})`}>
          <rect x={4} y={-24} width={w - 8} height={48} rx={6} fill={i === active ? K.cyan : K.panel} stroke={i === active ? "none" : "rgba(255,255,255,0.25)"} strokeWidth={2} filter={i === active ? "url(#kglow)" : undefined} />
          <text x={w / 2} y={8} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={20} fill={i === active ? "#081020" : K.muted}>{c}</text>
        </g>
      ))}
    </g>
  );
};

/** Signal waveform panel ("GATE SIGNAL" style). `bursts` pulses per second. */
export const Waveform: React.FC<{ x: number; y: number; w?: number; h?: number; t: number; title: string; note?: string; color?: string; s?: number }> = ({
  x,
  y,
  w = 620,
  h = 160,
  t,
  title,
  note,
  color = K.cyan,
  s = 1,
}) => {
  if (s <= 0.01) return null;
  const n = 120;
  const d = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const env = Math.max(0, Math.sin((u * 6 - t * 3) * Math.PI));
    const v = Math.sin(u * 140 + t * 20) * env * (h * 0.32);
    return `${i ? "L" : "M"}${(x + 24 + u * (w - 48)).toFixed(1)},${(y + h * 0.58 + v).toFixed(1)}`;
  }).join(" ");
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-x - w / 2} ${-y - h / 2})`}>
      <rect x={x} y={y} width={w} height={h} rx={16} fill={K.panel} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      <text x={x + 24} y={y + 36} fontFamily={BODY} fontWeight={900} fontSize={20} fill={K.white}>{title}</text>
      {note ? <text x={x + w - 24} y={y + 36} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={18} fill={color}>{note}</text> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={4} filter="url(#kglow)" />
    </g>
  );
};

/** Horizontal meter with label and value (progress, signal strength). */
export const Meter: React.FC<{ x: number; y: number; w?: number; label: string; value: number; color?: string; right?: string }> = ({
  x,
  y,
  w = 620,
  label,
  value,
  color = K.cyan,
  right,
}) => (
  <g>
    <text x={x} y={y - 14} fontFamily={BODY} fontWeight={900} fontSize={22} fill={K.white}>{label}</text>
    {right ? <text x={x + w} y={y - 14} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={22} fill={color}>{right}</text> : null}
    <rect x={x} y={y} width={w} height={18} rx={9} fill="#1B2440" />
    <rect x={x} y={y} width={w * clamp01(value)} height={18} rx={9} fill={color} filter="url(#kglow)" />
  </g>
);

/** Vertical bar chart. Last bar can be highlighted. */
export const BarChart: React.FC<{ x: number; y: number; w?: number; h?: number; values: number[]; grow?: number; highlight?: number; labels?: string[] }> = ({
  x,
  y,
  w = 700,
  h = 260,
  values,
  grow = 1,
  highlight,
  labels,
}) => {
  const max = Math.max(...values);
  const bw = w / values.length;
  return (
    <g>
      {values.map((v, i) => {
        const bh = (v / max) * h * clamp01(grow * values.length - i);
        return (
          <g key={i}>
            <rect x={x + i * bw + 6} y={y + h - bh} width={bw - 12} height={bh} rx={4} fill={i === highlight ? "#FF4FA3" : K.cyan} filter="url(#kglow)" />
            {labels ? <text x={x + i * bw + bw / 2} y={y + h + 30} textAnchor="middle" fontFamily={MONO} fontSize={18} fill={K.muted}>{labels[i]}</text> : null}
          </g>
        );
      })}
    </g>
  );
};

/** Checklist with ticks and crossed-out options ("TECHNICAL ISSUE ✓ / CYBERATTACK ✗"). */
export const Checklist: React.FC<{ x: number; y: number; items: { text: string; ok: boolean }[]; reveal?: number; w?: number }> = ({
  x,
  y,
  items,
  reveal = 1,
  w = 760,
}) => (
  <g>
    {items.map((it, i) => {
      const on = clamp01(reveal * items.length - i);
      const c = it.ok ? K.cyan : K.muted;
      return (
        <g key={i} transform={`translate(${x} ${y + i * 130})`} opacity={0.35 + 0.65 * on}>
          <rect x={0} y={0} width={w} height={108} rx={10} fill={it.ok && on > 0.5 ? "rgba(46,211,255,0.12)" : K.panel} stroke={it.ok && on > 0.5 ? K.cyan : "rgba(255,255,255,0.18)"} strokeWidth={3} />
          <rect x={26} y={26} width={56} height={56} rx={6} fill="none" stroke={c} strokeWidth={4} />
          {on > 0.5 ? (
            it.ok ? (
              <path d="M38 54 L50 66 L72 40" fill="none" stroke={K.cyan} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <g stroke={K.white} strokeWidth={6} strokeLinecap="round">
                <line x1={40} y1={40} x2={68} y2={68} />
                <line x1={68} y1={40} x2={40} y2={68} />
              </g>
            )
          ) : null}
          <text x={110} y={68} fontFamily={DISPLAY} fontSize={50} fill={it.ok ? K.white : K.muted} textDecoration={!it.ok && on > 0.5 ? "line-through" : undefined}>
            {it.text}
          </text>
        </g>
      );
    })}
  </g>
);

/** News screenshot card: source line, headline, quote. */
export const NewsCard: React.FC<{ x: number; y: number; w?: number; source: string; headline: string; body?: string; tag?: string; s?: number }> = ({
  x,
  y,
  w = 760,
  source,
  headline,
  body,
  tag = "NEWS REPORT",
  s = 1,
}) => {
  if (s <= 0.01) return null;
  const words = headline.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).trim().length > 34) {
      lines.push(cur.trim());
      cur = wd;
    } else cur += " " + wd;
  }
  lines.push(cur.trim());
  const h = 120 + lines.length * 46 + (body ? 70 : 0);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={0} y={-52} width={200} height={40} rx={6} fill={K.panel} stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
      <text x={100} y={-25} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={18} fill={K.white}>{tag}</text>
      <rect x={0} y={0} width={w} height={h} rx={8} fill="#F7F8FB" />
      <rect x={0} y={0} width={w} height={40} rx={8} fill="#E3E6EE" />
      {[18, 38, 58].map((cx) => (
        <circle key={cx} cx={cx} cy={20} r={6} fill="#B9BFCC" />
      ))}
      <text x={84} y={27} fontFamily={MONO} fontSize={18} fill="#6A7184">{source}</text>
      {lines.map((ln, i) => (
        <text key={i} x={28} y={92 + i * 46} fontFamily={BODY} fontWeight={900} fontSize={36} fill="#111622">{ln}</text>
      ))}
      {body ? <text x={28} y={110 + lines.length * 46} fontFamily={BODY} fontWeight={700} fontSize={22} fill="#4A5163">{body}</text> : null}
    </g>
  );
};

/** Big glowing number or word with a small label underneath. */
export const BigStat: React.FC<{ x: number; y: number; value: string; label?: string; color?: string; size?: number; s?: number }> = ({
  x,
  y,
  value,
  label,
  color = K.cyan,
  size = 220,
  s = 1,
}) =>
  s <= 0.01 ? null : (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <text x={0} y={0} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={size} fill={color} filter="url(#kglow)">{value}</text>
      {label ? (
        <text x={0} y={size * 0.32} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={K.white} letterSpacing={2}>{label}</text>
      ) : null}
    </g>
  );

/** Title card for the hook or the closing question (big, two-tone). */
export const TitleCard: React.FC<{ y: number; line1: string; line2?: string; sub?: string; s?: number; accent?: string }> = ({
  y,
  line1,
  line2,
  sub,
  s = 1,
  accent = K.cyan,
}) =>
  s <= 0.01 ? null : (
    <g transform={`translate(540 ${y}) scale(${s})`}>
      <text x={0} y={0} textAnchor="middle" fontFamily={DISPLAY} fontSize={104} fill={K.white} stroke="#000" strokeWidth={10} paintOrder="stroke">{line1}</text>
      {line2 ? <text x={0} y={100} textAnchor="middle" fontFamily={DISPLAY} fontSize={104} fill={accent} stroke="#000" strokeWidth={10} paintOrder="stroke">{line2}</text> : null}
      {sub ? <text x={0} y={line2 ? 160 : 70} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={26} fill={K.white}>{sub}</text> : null}
    </g>
  );

/**
 * Honesty footer: retired on the owner's instruction (2026-11-22). Videos carry no on-screen
 * footer; sources live in the post caption file. Kept as a no-op so older stages still compile.
 */
export const Disclaimer: React.FC<{ text?: string }> = () => null;

/** Closing channel card with a follow button being tapped. */
export const EndCard: React.FC<{ t: number; s?: number; name?: string; handle?: string; tagline?: string }> = ({
  t,
  s = 1,
  name = "Frontier in 60",
  handle = "@frontierin60",
  tagline = "The world, explained in 60 seconds",
}) => {
  if (s <= 0.01) return null;
  const tapped = t > 1.1;
  const fy = 880 + Math.max(0, 1 - t / 0.9) * 120;
  return (
    <g transform={`translate(540 800) scale(${s}) translate(-540 -800)`}>
      <rect x={250} y={520} width={580} height={560} rx={40} fill="#0E1426" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
      <circle cx={540} cy={640} r={70} fill={K.cyan} filter="url(#kglow)" />
      <text x={540} y={668} textAnchor="middle" fontFamily={DISPLAY} fontSize={78} fill="#081020">60</text>
      <text x={540} y={780} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={48} fill={K.white}>{name}</text>
      <text x={540} y={822} textAnchor="middle" fontFamily={MONO} fontSize={24} fill={K.cyan}>{handle}</text>
      <text x={540} y={862} textAnchor="middle" fontFamily={BODY} fontWeight={700} fontSize={24} fill={K.muted}>{tagline}</text>
      <rect x={350} y={910} width={380} height={86} rx={20} fill={tapped ? "#26304A" : K.red} />
      <text x={540} y={966} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={36} fill={K.white}>{tapped ? "Following ✓" : "Follow"}</text>
      <g transform={`translate(600 ${fy + (tapped ? 0 : 20)}) scale(${tapped && t < 1.3 ? 0.9 : 1})`}>
        <path d="M0 0 C 6 -30, 20 -30, 22 0 L 26 60 C 40 50, 56 60, 52 80 L 40 130 L -10 130 L -26 70 C -30 50, -10 46, -4 64 Z" fill="#F2C9A6" stroke="#8A5A3A" strokeWidth={3} />
      </g>
    </g>
  );
};
