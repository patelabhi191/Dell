import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, useBeat } from "../beats";
import { BODY, DISPLAY, useTheme } from "../theme";
import {
  AIRPORTS,
  CENTERS,
  FAIL_AT,
  FLIGHTS,
  LINKS,
  MapPlane,
  Monitor,
  OlderThan,
  SKY_PLANES,
  StopButton,
  Terminal,
  US,
  clamp01,
  curve,
  ease,
} from "./groundstop";

/**
 * Full-screen "cinema" version of the ground-stop story (test look, modelled on the benchmark
 * reel's presentation): a tilted night map of glowing city lights fills the frame, a virtual
 * camera moves between scenes, and every graphic lives inside the picture. Text is limited to
 * small labels; the story is carried by the captions at the top.
 *
 * Uses the same beats and cues as episode 004.
 */

const W = 1080;
const GOLD = "#E2B656";
const GREEN = "#3DFF9A";
const CYAN = "#4DD8FF";
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';

// ---------------------------------------------------------------- city lights
const insideUS = (x: number, y: number) => {
  let hit = false;
  for (let i = 0, j = US.length - 1; i < US.length; j = i++) {
    const [xi, yi] = US[i];
    const [xj, yj] = US[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const LIGHTS = (() => {
  const out: { x: number; y: number; r: number; c: string; w: number; ph: number }[] = [];
  const colors = ["#FFE7A8", "#FFD27A", "#FFF6DD", "#FFB86B"];
  for (let i = 0; out.length < 650 && i < 4000; i++) {
    let x: number;
    let y: number;
    if (i % 10 < 6) {
      const a = AIRPORTS[i % AIRPORTS.length];
      const ang = random(`la${i}`) * Math.PI * 2;
      const d = Math.pow(random(`ld${i}`), 1.6) * 46;
      x = a[1] + Math.cos(ang) * d;
      y = a[2] + Math.sin(ang) * d * 0.8;
    } else {
      x = 85 + random(`lx${i}`) * 820;
      y = 215 + random(`ly${i}`) * 455;
    }
    if (!insideUS(x, y)) continue;
    out.push({
      x,
      y,
      r: 0.9 + Math.pow(random(`lr${i}`), 3) * 3.2,
      c: colors[i % colors.length],
      w: 1 + random(`lw${i}`) * 3,
      ph: random(`lp${i}`) * 6,
    });
  }
  return out;
})();
const DOTS_2009 = Array.from({ length: 44 }, (_, i) => {
  for (let k = 0; k < 40; k++) {
    const x = 100 + random(`w9x${i}-${k}`) * 800;
    const y = 225 + random(`w9y${i}-${k}`) * 440;
    if (insideUS(x, y)) return { x, y, when: 0.6 + random(`w9t${i}`) * 1.8 };
  }
  return { x: 500, y: 400, when: 1 };
});

// ---------------------------------------------------------------- camera
type Cam = { rx: number; rz: number; s: number; tx: number; ty: number; dim: number };
const CAMS: [string, Partial<Cam>][] = [
  ["grounded", { dim: 0.28 }],
  ["older", { rx: 62, rz: -26, s: 2.3, ty: 200, dim: 0.2 }],
  ["flights", { rx: 48, rz: -8, s: 2.05, tx: 40, ty: 120, dim: 1 }],
  ["centers", { rx: 36, rz: 0, s: 1.85, ty: 60, dim: 1 }],
  ["apart", { rx: 32, rz: 0, s: 3.6, tx: 250, ty: 300, dim: 1 }],
  ["lost", { rx: 40, rz: 5, s: 1.9, tx: 0, ty: 80, dim: 1 }],
  ["cyber", { dim: 0.28 }],
  ["router", { dim: 0.1 }],
  ["warned", { rx: 38, rz: -4, s: 1.9, tx: 0, ty: 80, dim: 1 }],
  ["money", { dim: 0.14 }],
  ["question", { rx: 64, rz: -22, s: 2.6, ty: 240, dim: 0.22 }],
];
const START: Cam = { rx: 56, rz: -16, s: 2.2, tx: 30, ty: 150, dim: 1 };

// ---------------------------------------------------------------- small parts
const Label: React.FC<{ x: number; y: number; text: string; color?: string; size?: number; s?: number }> = ({
  x,
  y,
  text,
  color = "#DDE3FF",
  size = 26,
  s = 1,
}) => {
  if (s <= 0.01) return null;
  const w = text.length * size * 0.62 + size * 1.4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-w / 2} y={-size * 1.1} width={w} height={size * 2.2} rx={size * 0.5} fill="rgba(8,12,28,0.85)" stroke="rgba(255,255,255,0.28)" strokeWidth={2} />
      <text x={0} y={size * 0.36} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={size} fill={color}>
        {text}
      </text>
    </g>
  );
};

const Big: React.FC<{ x: number; y: number; text: string; color: string; size: number; s?: number; font?: string }> = ({
  x,
  y,
  text,
  color,
  size,
  s = 1,
  font = DISPLAY,
}) =>
  s <= 0.01 ? null : (
    <g transform={`translate(${x} ${y}) scale(${s})`} filter="url(#oglow)">
      <text x={0} y={0} textAnchor="middle" fontFamily={font} fontWeight={900} fontSize={size} fill={color}>
        {text}
      </text>
    </g>
  );

/** Beige network rack (two units) in the benchmark's "old hardware" look. */
const Rack: React.FC<{ t: number; alarm: boolean; crossed?: number }> = ({ t, alarm, crossed = 0 }) => (
  <g>
    <ellipse cx={30} cy={150} rx={270} ry={26} fill="rgba(0,0,0,0.5)" />
    {[0, 1].map((r) => (
      <g key={r} transform={`translate(0 ${r * 120 - 60})`}>
        <polygon points="-230,-50 -190,-80 270,-80 230,-50" fill="#EFE6CF" />
        <polygon points="230,-50 270,-80 270,30 230,60" fill="#B5A983" />
        <rect x={-230} y={-50} width={460} height={110} rx={10} fill="#DDD1AE" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={-200 + i * 40} y={18} width={24} height={14} rx={3} fill="#3D3F4A" />
        ))}
        {Array.from({ length: 8 }, (_, i) => {
          const on = alarm ? Math.sin(t * 28 + i * 2 + r) > -0.2 : Math.sin(t * 5 + i * 1.3 + r) > 0;
          return <circle key={i} cx={-196 + i * 22} cy={-20} r={6} fill={alarm ? "#FF4B3E" : i % 2 ? GREEN : "#F5B700"} opacity={on ? 1 : 0.25} />;
        })}
      </g>
    ))}
    <g transform="translate(110 -150) rotate(-3)">
      <rect x={-110} y={-28} width={220} height={56} rx={8} fill="#FFFFFF" />
      <text x={0} y={-4} textAnchor="middle" fontFamily={MONO} fontSize={15} fontWeight={700} fill="#555">THE NETWORK</text>
      <text x={0} y={20} textAnchor="middle" fontFamily={DISPLAY} fontSize={26} fill="#111">JULY 2002</text>
    </g>
    {crossed > 0 ? (
      <g stroke="#FF4B3E" strokeWidth={34} strokeLinecap="round" opacity={0.9}>
        <line x1={-260} y1={-170} x2={lerp(-260, 290, crossed)} y2={lerp(-170, 190, crossed)} />
        {crossed > 0.5 ? <line x1={290} y1={-170} x2={lerp(290, -260, (crossed - 0.5) * 2)} y2={lerp(-170, 190, (crossed - 0.5) * 2)} /> : null}
      </g>
    ) : null}
  </g>
);

/** Rotating hologram cube for the money shot. */
const Hologram: React.FC<{ t: number; s: number }> = ({ t, s }) => {
  const a = t * 0.7 + 0.5;
  const S = 200;
  const pts = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
  const proj = ([x, y, z]: number[]) => {
    const xr = x * Math.cos(a) - z * Math.sin(a);
    const zr = x * Math.sin(a) + z * Math.cos(a);
    return [xr * S, y * S * 0.9 + zr * S * 0.32];
  };
  const P = pts.map(proj);
  const edges: [number, number][] = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const d = pts[i].reduce((n, v, k) => n + (v !== pts[j][k] ? 1 : 0), 0);
    if (d === 1) edges.push([i, j]);
  }
  return (
    <g transform={`scale(${s})`} filter="url(#oglow)">
      {Array.from({ length: 7 }, (_, k) => (
        <line key={k} x1={-S} y1={-S + (k + 1) * (S / 4)} x2={S} y2={-S + (k + 1) * (S / 4)} stroke={CYAN} strokeWidth={2} opacity={0.18 + 0.12 * Math.sin(t * 4 + k)} />
      ))}
      {edges.map(([i, j], k) => (
        <line key={k} x1={P[i][0]} y1={P[i][1]} x2={P[j][0]} y2={P[j][1]} stroke={CYAN} strokeWidth={5} strokeLinecap="round" />
      ))}
      {P.map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={7} fill="#FFFFFF" />
      ))}
    </g>
  );
};

// ---------------------------------------------------------------- stage
export const GroundStopCinema: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const hook = useBeat("hook");
  const grounded = useBeat("grounded");
  const older = useBeat("older");
  const flights = useBeat("flights");
  const stop = useBeat("stop");
  const hit = useBeat("hit");
  const frozen = useBeat("frozen");
  const centers = useBeat("centers");
  const talk = useBeat("talk");
  const apart = useBeat("apart");
  const lost = useBeat("lost");
  const fail = useBeat("fail");
  const cyber = useBeat("cyber");
  const safe = useBeat("safe");
  const router = useBeat("router");
  const flood = useBeat("flood");
  const warned = useBeat("warned");
  const money = useBeat("money");
  const question = useBeat("question");
  const camBeats = CAMS.map(([name]) => useBeat(name)); // fixed list, same order every frame

  // Camera: glide from target to target as each beat starts.
  let cam: Cam = { ...START };
  CAMS.forEach(([, target], i) => {
    const b = camBeats[i];
    if (!b.on) return;
    const w = ease(b.t / 0.9);
    const next = { ...cam, ...target };
    cam = {
      rx: lerp(cam.rx, next.rx, w),
      rz: lerp(cam.rz, next.rz, w),
      s: lerp(cam.s, next.s, w),
      tx: lerp(cam.tx, next.tx, w),
      ty: lerp(cam.ty, next.ty, w),
      dim: lerp(cam.dim, next.dim, w),
    };
  });
  const drift = Math.sin(t * 0.25) * 4 + t * 0.6;
  const breathe = 1 + Math.sin(t * 0.6) * 0.015;

  const between = (a: ReturnType<typeof useBeat>, b?: ReturnType<typeof useBeat>, fade = 0.25) =>
    a.ramp(0, fade) * (b ? 1 - b.ramp(0, fade) : 1);
  const asCenters = centers.ramp(0, 0.5);
  const failed = (i: number) => fail.on && FAIL_AT[i] !== null && fail.t >= (FAIL_AT[i] as number);
  const failedCount = CENTERS.filter((_, i) => failed(i)).length;
  const frozenAt = frozen.start !== undefined ? frozen.start / fps : Infinity;
  const gap = lost.start !== undefined && cyber.start !== undefined ? (cyber.start - lost.start) / fps : 3;
  const warnedOn = between(warned, money);

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #13204A 0%, #070B1A 55%, #020309 100%)" }}>
      {/* ---------------- the map, in perspective ---------------- */}
      <div style={{ position: "absolute", inset: 0, perspective: "1500px", perspectiveOrigin: "50% 32%" }}>
        <div
          style={{
            position: "absolute",
            left: (W - 1200) / 2,
            top: 900 - 600,
            width: 1200,
            height: 1200,
            opacity: cam.dim,
            transform: `translate(${cam.tx}px, ${cam.ty}px) rotateX(${cam.rx}deg) rotateZ(${cam.rz + drift}deg) scale(${cam.s * breathe})`,
          }}
        >
          <svg viewBox="40 0 940 940" width={1200} height={1200} style={{ overflow: "visible" }}>
            <defs>
              <filter id="mglow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="mglow2" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {Array.from({ length: 26 }, (_, i) => (
              <line key={`gx${i}`} x1={-200 + i * 60} y1={-100} x2={-200 + i * 60} y2={1050} stroke="#6E86D8" strokeWidth={1.2} opacity={0.08} />
            ))}
            {Array.from({ length: 20 }, (_, i) => (
              <line key={`gy${i}`} x1={-200} y1={-100 + i * 60} x2={1300} y2={-100 + i * 60} stroke="#6E86D8" strokeWidth={1.2} opacity={0.08} />
            ))}
            <polygon points={US.map((p) => p.join(",")).join(" ")} fill="#101836" />
            <polygon points={US.map((p) => p.join(",")).join(" ")} fill="none" stroke="#5A73C9" strokeWidth={2.5} strokeLinejoin="round" filter="url(#mglow)" />

            {/* city lights */}
            <g filter="url(#mglow)">
              {LIGHTS.map((l, i) => (
                <circle key={i} cx={l.x} cy={l.y} r={l.r} fill={l.c} opacity={(0.55 + 0.45 * Math.sin(t * l.w + l.ph)) * (warnedOn > 0.5 ? 0.45 : 1)} />
              ))}
            </g>

            {/* flight paths and planes between airports, until the freeze */}
            {asCenters < 1
              ? FLIGHTS.map(([a, b], i) => {
                  const r = curve([AIRPORTS[a][1], AIRPORTS[a][2]], [AIRPORTS[b][1], AIRPORTS[b][2]], -0.2);
                  const gone = frozen.ramp(0.1 + (i % 8) * 0.12, 0.5 + (i % 8) * 0.12);
                  return (
                    <path key={i} d={r.d} fill="none" stroke={CYAN} strokeWidth={2.2} strokeDasharray="6 8" strokeDashoffset={-t * 50} opacity={0.6 * (1 - gone) * (1 - asCenters)} filter="url(#mglow)" />
                  );
                })
              : null}
            {asCenters < 1
              ? FLIGHTS.slice(0, 12).map(([a, b], i) => {
                  const r = curve([AIRPORTS[a][1], AIRPORTS[a][2]], [AIRPORTS[b][1], AIRPORTS[b][2]], -0.2);
                  const speed = 0.14 + (i % 4) * 0.03;
                  const raw = t * speed + i / 12;
                  let p = raw % 1;
                  if (t >= frozenAt) {
                    const k = Math.floor(frozenAt * speed + i / 12);
                    p = raw - k;
                    if (p >= 1) return null;
                  }
                  const [x, y] = r.at(p);
                  const [bx, by] = r.at(Math.max(0, p - 0.06));
                  const [nx, ny] = r.at(Math.min(1, p + 0.01));
                  const o = Math.sin(p * Math.PI) * (1 - asCenters);
                  return (
                    <g key={i} opacity={o}>
                      <line x1={bx} y1={by} x2={x} y2={y} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.45} />
                      <MapPlane x={x} y={y} angle={(Math.atan2(ny - y, nx - x) * 180) / Math.PI} color="#FFFFFF" scale={0.75} />
                      <circle cx={x} cy={y} r={3} fill={Math.sin(t * 8 + i) > 0 ? "#FF4B3E" : GREEN} />
                    </g>
                  );
                })
              : null}
            {asCenters < 1
              ? AIRPORTS.map(([name, x, y], i) => {
                  const flipAt = 0.25 + i * 0.09;
                  const red = frozen.on && frozen.t > flipAt;
                  const bump = red ? 1 + 0.8 * Math.max(0, 1 - (frozen.t - flipAt) / 0.3) : 1;
                  const c = red ? theme.alert : GOLD;
                  return (
                    <g key={name} transform={`translate(${x} ${y}) scale(${bump})`} opacity={1 - asCenters} filter="url(#mglow2)">
                      <circle r={7} fill={c} />
                      <circle r={14 + ((t + i * 0.3) % 1) * 16} fill="none" stroke={c} strokeWidth={2} opacity={1 - ((t + i * 0.3) % 1)} />
                    </g>
                  );
                })
              : null}

            {/* control centers, links, traffic */}
            {asCenters > 0
              ? LINKS.map(([a, b], i) => {
                  const grow = talk.enter(0.2 + i * 0.06, 18);
                  if (grow <= 0.01) return null;
                  const times = [FAIL_AT[a], FAIL_AT[b]].filter((v): v is number => v !== null);
                  const breakAt = times.length ? Math.min(...times) : null;
                  const cut = breakAt !== null && fail.on ? clamp01((fail.t - breakAt) / 0.45) : 0;
                  const [x1, y1] = CENTERS[a];
                  const [x2, y2] = CENTERS[b];
                  const half = cut === 0 ? grow : 0.5 * (1 - cut);
                  return (
                    <g key={i} stroke={GREEN} strokeWidth={3} strokeLinecap="round" opacity={asCenters * (1 - cut * 0.6) * (1 - warnedOn)} filter="url(#mglow)">
                      <line x1={x1} y1={y1} x2={lerp(x1, x2, half)} y2={lerp(y1, y2, half)} />
                      {cut > 0 ? <line x1={x2} y1={y2} x2={lerp(x2, x1, half)} y2={lerp(y2, y1, half)} /> : null}
                      {cut > 0 && cut < 1 ? <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={12 * (1 - cut)} fill={theme.alert} stroke="none" /> : null}
                    </g>
                  );
                })
              : null}
            {asCenters > 0
              ? SKY_PLANES.map((pl, i) => {
                  const r = curve(CENTERS[pl.a], CENTERS[pl.b], 0.12);
                  const p = (Math.max(0, centers.t) * pl.speed + pl.offset) % 1;
                  const [x, y] = r.at(p);
                  const [nx, ny] = r.at(Math.min(1, p + 0.01));
                  const vanishAt = (i / SKY_PLANES.length) * gap * 0.85;
                  const vanish = cyber.on ? 0 : lost.on ? 1 - clamp01((lost.t - vanishAt) / 0.4) : 1;
                  const o = centers.enter(0.25 + i * 0.03, 12) * vanish;
                  return o > 0.01 ? (
                    <g key={i} opacity={o}>
                      <MapPlane x={x} y={y} angle={(Math.atan2(ny - y, nx - x) * 180) / Math.PI} color="#FFFFFF" scale={0.7} />
                    </g>
                  ) : null;
                })
              : null}
            {asCenters > 0
              ? CENTERS.map(([x, y], i) => {
                  const red = failed(i);
                  const c = red ? theme.alert : GREEN;
                  const pop = centers.enter(0.1 + i * 0.035, 9);
                  const ring = (t * 0.8 + i * 0.37) % 1;
                  return (
                    <g key={i} transform={`translate(${x} ${y})`} opacity={asCenters * (1 - warnedOn)} filter="url(#mglow2)">
                      <circle r={10 + ring * 34} fill="none" stroke={c} strokeWidth={2.5} opacity={(1 - ring) * 0.9} />
                      <circle r={9 * pop} fill={c} />
                    </g>
                  );
                })
              : null}
            {apart.on && !lost.on ? (
              <g transform={`translate(455 395) scale(${apart.enter(0, 9)})`} filter="url(#mglow)">
                <circle cx={-55} cy={0} r={62} fill={GOLD} opacity={0.12} />
                <circle cx={-55} cy={0} r={62} fill="none" stroke={GOLD} strokeWidth={4} strokeDasharray="10 8" strokeDashoffset={-t * 30} />
                <circle cx={70} cy={0} r={40} fill="none" stroke={theme.alert} strokeWidth={3} opacity={0.8} />
                <MapPlane x={-55} y={0} angle={0} color={GOLD} scale={1.3} />
                <MapPlane x={70} y={0} angle={180} color="#FFFFFF" scale={1.3} />
              </g>
            ) : null}

            {/* 2009 outage dots */}
            {warnedOn > 0.01
              ? DOTS_2009.map((d, i) => {
                  const red = warned.t > d.when;
                  const bump = red ? 1 + 0.8 * Math.max(0, 1 - (warned.t - d.when) / 0.3) : 1;
                  return <circle key={i} cx={d.x} cy={d.y} r={8 * bump} fill={red ? theme.alert : "#5A73C9"} opacity={warnedOn} filter="url(#mglow2)" />;
                })
              : null}
          </svg>
        </div>
      </div>

      {/* ---------------- graphics in screen space ---------------- */}
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <filter id="oglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="vignette" cx="50%" cy="48%" r="70%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
          </radialGradient>
        </defs>

        {/* HOOK: timestamp + GROUND STOP */}
        {(() => {
          const o = 1 - grounded.ramp(0, 0.25);
          if (o <= 0.01) return null;
          const gs = hook.t > 1 ? clamp01((hook.t - 1) / 0.15) * (hook.t < 1.4 && Math.sin(hook.t * 70) < 0 ? 0.3 : 1) : 0;
          return (
            <g opacity={o}>
              <Big x={540} y={1180} text="GROUND STOP" color={theme.alert} size={150} s={gs} />
              <Label x={540} y={1250} text="EVERY DEPARTURE IN THE U.S." size={24} s={gs} />
              <Label x={540} y={1360} text="FRIDAY 13 NOV 2026 · 3:54 PM ET" size={28} />
            </g>
          );
        })()}

        {/* GROUNDED: three plaques */}
        {(() => {
          const o = between(grounded, older);
          if (o <= 0.01) return null;
          const cards = [
            { n: 1, year: "2001", date: "SEPTEMBER 11" },
            { n: 2, year: "2023", date: "JANUARY 11" },
            { n: 3, year: "2026", date: "NOVEMBER 13" },
          ];
          return (
            <g opacity={o}>
              {cards.map((c, i) => {
                const s = grounded.enter(0.1 + i * 0.32, 9);
                const y = 720 + i * 245 + (i === 2 ? Math.sin(t * 4) * 6 : 0);
                if (s <= 0.01) return null;
                return (
                  <g key={c.year} transform={`translate(540 ${y}) scale(${s}) rotate(${(i - 1) * -2})`}>
                    <rect x={-300} y={-100} width={600} height={200} rx={20} fill="rgba(0,0,0,0.5)" transform="translate(10 16)" />
                    <rect x={-300} y={-100} width={600} height={200} rx={20} fill="#0E1328" stroke={i === 2 ? theme.alert : GOLD} strokeWidth={5} filter={i === 2 ? "url(#oglow)" : undefined} />
                    <text x={0} y={-56} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={20} fill="#8C93AD">NATIONWIDE GROUND STOP {c.n}</text>
                    <text x={0} y={36} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={104} fill="#F4F3EE">{c.year}</text>
                    <text x={0} y={78} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={i === 2 ? theme.alert : GOLD}>{c.date}</text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* OLDER THAN THE IPHONE */}
        {between(older, flights) > 0.01 ? (
          <g opacity={between(older, flights)} transform="translate(-20 330) scale(1.08)">
            <OlderThan t={older.t} enter={older.enter} />
          </g>
        ) : null}

        {/* STOP: the button, then the clock */}
        {(() => {
          const o = between(stop, frozen, 0.35);
          return o > 0.01 ? (
            <g opacity={o} transform={`translate(540 980) scale(${2.8 * stop.enter(0, 10)}) translate(-170 -80)`}>
              <StopButton t={hit.on ? hit.t : 0} s={1} />
            </g>
          ) : null;
        })()}
        {(() => {
          const o = between(frozen, centers);
          if (o <= 0.01) return null;
          const hrs = Math.min(4, Math.floor(frozen.t * 1.8) + 1);
          return (
            <g opacity={o}>
              <Big x={540} y={1200} text="3:54 PM" color={theme.alert} size={150} s={frozen.enter(0, 10)} />
              <Label x={540} y={1280} text={`+${hrs}${hrs >= 4 ? "+" : ""} HRS · NOTHING TAKES OFF`} size={26} color="#FFB3AC" s={frozen.enter(0.2, 10)} />
            </g>
          );
        })()}

        {/* CENTERS: 22 */}
        {(() => {
          const o = between(centers, apart.on ? apart : lost);
          return o > 0.01 ? (
            <g opacity={o}>
              <Big x={540} y={1250} text="22" color={GREEN} size={250} s={centers.enter(0.2, 9)} font={BODY} />
              <Label x={540} y={1320} text="RADAR ROOMS WATCH THE WHOLE SKY" size={24} s={centers.enter(0.4, 10)} />
            </g>
          ) : null;
        })()}
        {between(talk, apart.on ? apart : lost) > 0.01 ? (
          <g opacity={between(talk, apart.on ? apart : lost)}>
            <Label x={540} y={1360} text="RADAR + RADIO · ONE NETWORK" size={26} color={GREEN} s={talk.enter(0.1, 10)} />
          </g>
        ) : null}
        {between(apart, lost) > 0.01 ? (
          <g opacity={between(apart, lost)}>
            <Label x={540} y={1340} text="AT LEAST 5 MILES APART" size={28} color={GOLD} s={apart.enter(0.3, 9)} />
          </g>
        ) : null}

        {/* LOST: live count of failed centers */}
        {(() => {
          const o = between(lost, cyber);
          if (o <= 0.01) return null;
          return (
            <g opacity={o}>
              <Big x={540} y={1250} text={`${failedCount}/22`} color={failedCount ? theme.alert : GREEN} size={200} s={lost.enter(0.1, 9)} font={BODY} />
              <Label x={540} y={1320} text={failedCount ? "CENTERS LOSING THEIR LINES" : "CENTERS ONLINE"} size={24} s={lost.enter(0.3, 10)} />
            </g>
          );
        })()}

        {/* CYBER: terminal */}
        {between(cyber, router) > 0.01 ? (
          <g opacity={between(cyber, router)} transform="translate(540 960) scale(1.3) translate(-500 -600)">
            <Terminal t={cyber.t} safeT={safe.on ? (safe.start! - cyber.start!) / fps : null} enter={cyber.enter(0, 11)} />
          </g>
        ) : null}

        {/* ROUTER + FLOOD: the rack, fiber, flood, screens going dark */}
        {(() => {
          const o = between(router, warned);
          if (o <= 0.01) return null;
          const swap = router.ramp(1.0, 2.4);
          const shake = flood.on ? Math.sin(t * 60) * 5 * Math.min(1, flood.t) : 0;
          const screens = [
            [190, 640],
            [890, 640],
            [190, 1330],
            [890, 1330],
          ];
          return (
            <g opacity={o}>
              {flood.on
                ? screens.map(([x, y], i) => (
                    <g key={i}>
                      <line x1={540} y1={980} x2={x} y2={y} stroke={theme.alert} strokeWidth={4} opacity={0.5} filter="url(#oglow)" />
                      {Array.from({ length: 7 }, (_, k) => {
                        const q = (t * 1.8 + k / 7 + i * 0.11) % 1;
                        return <circle key={k} cx={lerp(540, x, q)} cy={lerp(980, y, q)} r={9} fill={theme.alert} filter="url(#oglow)" />;
                      })}
                      <Monitor x={x} y={y} t={flood.t} offAt={1.0 + i * 0.5} scale={0.8 * flood.enter(0.1 + i * 0.1, 10)} />
                    </g>
                  ))
                : null}
              <line x1={-20} y1={1010} x2={lerp(330, -20, swap)} y2={1010} stroke="#C77B3A" strokeWidth={18} strokeLinecap="round" opacity={flood.on ? 0 : 1} />
              <line x1={-20} y1={950} x2={lerp(-20, 330, swap)} y2={950} stroke={CYAN} strokeWidth={12} strokeLinecap="round" filter="url(#oglow)" />
              {swap > 0.95
                ? [0, 1, 2].map((k) => <circle key={k} cx={((t * 500 + k * 120) % 350) - 20} cy={950} r={8} fill="#FFFFFF" filter="url(#oglow)" />)
                : null}
              <g transform={`translate(${560 + shake} 990) scale(${1.15 * router.enter(0, 10)})`}>
                <Rack t={t} alarm={flood.on} />
              </g>
              {!flood.on ? (
                <>
                  <Label x={540} y={700} text="COPPER  →  FIBER" size={30} color={CYAN} s={router.enter(0.8, 9)} />
                  <Label x={540} y={1330} text="CONTRACTOR · L3HARRIS" size={26} s={router.enter(0.4, 10)} />
                </>
              ) : (
                <Label x={540} y={1210} text="1,000+ REQUESTS / 5 SEC" size={30} color="#FFB3AC" s={flood.enter(0.4, 9)} />
              )}
            </g>
          );
        })()}

        {/* WARNED: the 2009 report + counter (map shows the dots) */}
        {warnedOn > 0.01 ? (
          <g opacity={warnedOn}>
            <g transform={`translate(540 640) rotate(-4) scale(${warned.enter(0.1, 9)})`}>
              <rect x={-230} y={-120} width={460} height={240} rx={12} fill="rgba(0,0,0,0.5)" transform="translate(10 14)" />
              <rect x={-230} y={-120} width={460} height={240} rx={12} fill="#ECE5D2" />
              <text x={-200} y={-74} fontFamily={MONO} fontWeight={700} fontSize={20} fill="#6B6552">TRANSPORTATION DEPT. REPORT</text>
              <text x={-200} y={-16} fontFamily={DISPLAY} fontSize={58} fill="#141414">NOV 2009</text>
              <text x={-200} y={24} fontFamily={MONO} fontWeight={700} fontSize={19} fill="#A3281D">ROUTER MISCONFIGURED</text>
              <text x={-200} y={50} fontFamily={MONO} fontWeight={700} fontSize={19} fill="#A3281D">ON THE SAME NETWORK</text>
              {[78, 98].map((y) => (
                <rect key={y} x={-200} y={y - 8} width={y === 98 ? 220 : 380} height={9} rx={4} fill="#C9C1A8" />
              ))}
            </g>
            <Big x={540} y={1280} text={`${Math.round(129 * ease((warned.t - 0.6) / 1.8))}`} color={theme.alert} size={170} s={warned.enter(0.5, 9)} font={BODY} />
            <Label x={540} y={1345} text="AIR TRAFFIC FACILITIES KNOCKED OUT" size={24} s={warned.enter(0.7, 10)} />
          </g>
        ) : null}

        {/* MONEY: hologram + counter */}
        {(() => {
          const o = between(money, question);
          if (o <= 0.01) return null;
          const v = Math.round(12.5e9 * ease(money.t / 1.4));
          return (
            <g opacity={o}>
              <g transform="translate(540 900)">
                <Hologram t={money.t} s={money.enter(0, 10)} />
              </g>
              <Big x={540} y={1250} text={`$${v.toLocaleString("en-US")}`} color={CYAN} size={92} s={money.enter(0.2, 10)} font={BODY} />
              <Label x={540} y={1320} text="APPROVED TO FIX AIR TRAFFIC CONTROL" size={24} s={money.enter(0.4, 10)} />
            </g>
          );
        })()}

        {/* QUESTION: same old box, crossed out, and the question */}
        {question.on ? (
          <g opacity={question.ramp(0, 0.25)}>
            <g transform={`translate(560 1000) scale(${1.05 * question.enter(0, 10)})`}>
              <Rack t={t} alarm={false} crossed={question.ramp(0.6, 1.4)} />
            </g>
            <Big x={540} y={760} text="?" color={GOLD} size={300} s={question.enter(1.2, 7) * (1 + Math.sin(t * 5) * 0.05)} font={BODY} />
            <Label x={540} y={1340} text="COMMENT: YES OR NO" size={30} color={GOLD} s={question.enter(1.8, 9)} />
          </g>
        ) : null}

        {/* stars and vignette over everything */}
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={random(`s${i}`) * 1080} cy={random(`sy${i}`) * 520} r={1 + random(`sr${i}`) * 1.8} fill="#FFFFFF" opacity={0.15 + 0.35 * Math.sin(t * (1 + random(`sw${i}`) * 2) + i)} />
        ))}
        <rect x={0} y={0} width={1080} height={1920} fill="url(#vignette)" />
      </svg>
    </AbsoluteFill>
  );
};
