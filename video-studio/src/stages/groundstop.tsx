import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, useBeat } from "../beats";
import { Person, Tag } from "../props";
import { BODY, DISPLAY, useTheme } from "../theme";

/**
 * Stage for "The router that grounded America" (FAA ground stop, 13 Nov 2026).
 *
 * Beats, in order:
 *  hook      pilot's view of a landing, altimeter counting down to a ground stop
 *  grounded  timeline of the three nationwide ground stops; planes parked and stamped
 *  box       the culprit, a small box with a face, drops in
 *  flights   US map, major airports in blue, flight paths animating between them
 *  stop      clock appears (3:54 PM ET)        cue "frozen": paths vanish, airports turn red
 *  centers   airports give way to the 22 en-route control centers; planes everywhere
 *  talk      voice links connect the centers, speech bubbles
 *  lost      map moves under the number        cue "fail": 17 centers turn red over 2 s
 *  notalk    last planes gone; failed centers pulse red
 *  router    remote site, copper swapped for fiber      flood: router floods the network
 */

const SKY = "#BFE6FF";
const GRASS = "#86D97B";
const LIVERY = ["#2563FF", "#F5B700", "#F04E23", "#22B573", "#8B5CF6", "#FF7AB6"];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

// ---------------------------------------------------------------- map data
const US = [
  [95, 215], [480, 225], [560, 235], [600, 255], [650, 250], [690, 285], [735, 300], [770, 280],
  [880, 215], [905, 235], [880, 290], [850, 330], [835, 380], [800, 440], [770, 500], [790, 560],
  [810, 640], [790, 650], [760, 590], [730, 560], [660, 565], [600, 575], [560, 600], [520, 670],
  [490, 640], [450, 590], [410, 585], [330, 560], [250, 545], [200, 535], [150, 470], [110, 400],
  [90, 320], [85, 260],
];
const AIRPORTS: [string, number, number][] = [
  ["SEA", 125, 240], ["SFO", 125, 375], ["LAX", 175, 470], ["LAS", 205, 420], ["PHX", 255, 495],
  ["SLC", 270, 320], ["DEN", 360, 370], ["DFW", 470, 535], ["IAH", 515, 595], ["MSP", 520, 268],
  ["ORD", 615, 300], ["DTW", 685, 308], ["ATL", 715, 495], ["CLT", 768, 445], ["MIA", 790, 612],
  ["DCA", 812, 365], ["JFK", 852, 300], ["BOS", 876, 248],
];
const LABELED = new Set(["SEA", "LAX", "DEN", "DFW", "ORD", "ATL", "JFK", "MIA"]);
const FLIGHTS: [number, number][] = [
  [16, 2], [0, 12], [10, 7], [17, 14], [1, 6], [3, 13], [9, 8], [15, 4], [11, 5], [12, 1],
  [6, 16], [7, 0], [2, 10], [14, 11], [5, 17], [8, 15],
];
// The 22 en-route control centers (positions are illustrative).
const CENTERS = [
  [130, 260], [150, 420], [215, 500], [250, 330], [300, 250], [340, 430], [390, 530], [420, 330],
  [470, 440], [500, 270], [520, 560], [570, 370], [610, 480], [640, 300], [670, 400], [700, 520],
  [730, 340], [760, 430], [780, 580], [800, 320], [840, 280], [690, 460],
];
const LINKS = [
  [0, 3], [3, 4], [1, 2], [2, 5], [3, 7], [5, 8], [7, 9], [8, 11], [6, 10], [9, 13], [11, 14],
  [10, 12], [12, 15], [13, 16], [14, 17], [16, 19], [19, 20], [15, 18], [17, 21], [5, 6], [7, 8],
  [1, 5], [4, 9], [16, 17], [12, 21],
];
// 17 of the 22 fail, each at its own moment within 2 seconds of the cue.
const ORDER = CENTERS.map((_, i) => i).sort((a, b) => random(`o${a}`) - random(`o${b}`));
const FAIL_AT: (number | null)[] = CENTERS.map((_, i) => {
  const rank = ORDER.indexOf(i);
  return rank < 17 ? (rank / 16) * 1.8 + random(`f${i}`) * 0.2 : null;
});
const SKY_PLANES = Array.from({ length: 30 }, (_, i) => {
  const a = Math.floor(random(`pa${i}`) * CENTERS.length);
  let b = Math.floor(random(`pb${i}`) * CENTERS.length);
  if (b === a) b = (a + 7) % CENTERS.length;
  return { a, b, speed: 0.06 + random(`ps${i}`) * 0.05, offset: random(`po${i}`), color: LIVERY[i % LIVERY.length] };
});

const curve = (from: number[], to: number[], bend: number) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const c = [(from[0] + to[0]) / 2 - (dy / len) * bend * len, (from[1] + to[1]) / 2 + (dx / len) * bend * len];
  const at = (q: number) => {
    const m = 1 - q;
    return [m * m * from[0] + 2 * m * q * c[0] + q * q * to[0], m * m * from[1] + 2 * m * q * c[1] + q * q * to[1]];
  };
  return { c, at, d: `M ${from[0]},${from[1]} Q ${c[0]},${c[1]} ${to[0]},${to[1]}` };
};

// ---------------------------------------------------------------- characters

/** Top-down plane for the map. */
const MapPlane: React.FC<{ x: number; y: number; angle: number; color: string; scale?: number; opacity?: number }> = ({
  x,
  y,
  angle,
  color,
  scale = 1,
  opacity = 1,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} opacity={opacity}>
    <rect x={-20} y={-5} width={40} height={10} rx={5} fill={color} />
    <polygon points="-2,-4 8,-4 -8,-22 -14,-22" fill={color} />
    <polygon points="-2,4 8,4 -8,22 -14,22" fill={color} />
    <polygon points="-20,-3 -15,-3 -22,-11 -25,-11" fill={color} />
    <polygon points="-20,3 -15,3 -22,11 -25,11" fill={color} />
    <circle cx={13} cy={0} r={3} fill="#FFFFFF" />
  </g>
);

/** Side-view cartoon plane with a face. Origin is the middle of the fuselage. */
const SidePlane: React.FC<{ color: string; mood: "happy" | "sad"; blink?: boolean }> = ({ color, mood, blink }) => {
  const theme = useTheme();
  return (
    <g>
      <polygon points="-128,-18 -150,-82 -112,-82 -84,-18" fill={color} />
      <rect x={-132} y={-28} width={264} height={56} rx={28} fill={color} />
      <rect x={-118} y={4} width={236} height={10} rx={5} fill="#FFFFFF" opacity={0.85} />
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={-92 + i * 24} cy={-8} r={5} fill="#FFFFFF" />
      ))}
      <polygon points="-24,10 40,10 4,52 -44,52" fill="rgba(0,0,0,0.22)" />
      <rect x={-4} y={30} width={34} height={16} rx={8} fill="rgba(0,0,0,0.28)" />
      <line x1={-58} y1={26} x2={-58} y2={38} stroke={theme.ink} strokeWidth={4} />
      <line x1={84} y1={26} x2={84} y2={38} stroke={theme.ink} strokeWidth={4} />
      <circle cx={-58} cy={42} r={9} fill={theme.ink} />
      <circle cx={84} cy={42} r={9} fill={theme.ink} />
      {/* face */}
      <ellipse cx={100} cy={-8} rx={14} ry={blink ? 2 : 14} fill="#FFFFFF" />
      {blink ? null : <circle cx={105} cy={mood === "sad" ? -4 : -9} r={6.5} fill={theme.ink} />}
      <path
        d={mood === "happy" ? "M 92 14 Q 104 24 116 14" : "M 92 21 Q 104 11 116 21"}
        fill="none"
        stroke={theme.ink}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {mood === "sad" ? <path d="M 88 -26 L 112 -20" stroke={theme.ink} strokeWidth={4} strokeLinecap="round" /> : null}
    </g>
  );
};

/** The router, as a character. */
const RouterBox: React.FC<{ color: string; mood: "curious" | "happy" | "panic"; t: number; lights?: string }> = ({
  color,
  mood,
  t,
  lights,
}) => {
  const theme = useTheme();
  const blink = mood !== "panic" && t % 3.2 < 0.12;
  const jitter = mood === "panic" ? Math.sin(t * 50) * 2 : 0;
  return (
    <g>
      <ellipse cx={0} cy={86} rx={190} ry={16} fill={theme.shadow} />
      {[-90, 90].map((x, i) => (
        <g key={x} transform={`rotate(${Math.sin(t * 3 + i) * (mood === "panic" ? 14 : 5)} ${x} -62)`}>
          <rect x={x - 6} y={-128} width={12} height={68} rx={6} fill={theme.slateDark} />
          <circle cx={x} cy={-130} r={11} fill={mood === "panic" ? theme.alert : theme.accent} />
        </g>
      ))}
      <rect x={-180} y={-66} width={360} height={140} rx={30} fill={color} />
      <rect x={-180} y={36} width={360} height={38} rx={19} fill="rgba(0,0,0,0.18)" />
      {Array.from({ length: 7 }, (_, i) => {
        const on = mood === "panic" ? Math.sin(t * 30 + i * 2) > -0.3 : Math.sin(t * 4 + i * 1.3) > 0;
        return <circle key={i} cx={-120 + i * 40} cy={55} r={8} fill={lights ?? theme.accent} opacity={on ? 1 : 0.3} />;
      })}
      {/* face */}
      <g transform={`translate(${jitter} 0)`}>
        {[-58, 58].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={-14} rx={mood === "panic" ? 28 : 24} ry={blink ? 3 : mood === "panic" ? 30 : 26} fill="#FFFFFF" />
            {blink ? null : (
              <circle
                cx={x + (mood === "curious" ? Math.sin(t * 1.5) * 8 : 0)}
                cy={-12}
                r={mood === "panic" ? 7 : 12}
                fill={theme.ink}
              />
            )}
          </g>
        ))}
        {mood === "panic" ? (
          <ellipse cx={0} cy={22} rx={16} ry={11} fill={theme.ink} />
        ) : (
          <path d="M -22 18 Q 0 34 22 18" fill="none" stroke={theme.ink} strokeWidth={6} strokeLinecap="round" />
        )}
        <circle cx={-104} cy={14} r={11} fill="#FF7AB6" opacity={0.6} />
        <circle cx={104} cy={14} r={11} fill="#FF7AB6" opacity={0.6} />
        {mood === "panic"
          ? [0, 1].map((k) => {
              const q = (t * 1.4 + k * 0.5) % 1;
              return <path key={k} d={`M ${150 + k * 22} ${-70 + q * 50} q 8 12 0 18 q -8 -6 0 -18`} fill="#7CC8FF" opacity={1 - q} />;
            })
          : null}
      </g>
    </g>
  );
};

// ---------------------------------------------------------------- scenes

const Cockpit: React.FC<{ t: number; p: number }> = ({ t, p }) => {
  const theme = useTheme();
  const touch = p >= 1;
  const shake = touch ? Math.sin(t * 45) * 5 * Math.max(0, 1 - (t - 4.2) * 2.5) : Math.sin(t * 9) * 1.2;
  const horizon = 470 - p * 30;
  const w0 = lerp(26, 150, ease(p));
  const w1 = lerp(240, 1500, Math.pow(p, 1.6));
  const bottom = 720;
  const alt = Math.max(0, Math.round(lerp(1200, 0, p) / 10) * 10);
  const shield = "M 120 300 Q 500 240 880 300 L 950 720 L 50 720 Z";
  const speed = 1 + p * 2.5;
  return (
    <g transform={`translate(0 ${shake})`}>
      <defs>
        <clipPath id="windshield">
          <path d={shield} />
        </clipPath>
      </defs>
      <g clipPath="url(#windshield)">
        <rect x={0} y={200} width={1000} height={600} fill={SKY} />
        {[0, 1, 2, 3].map((k) => {
          const q = (t * 0.22 * speed + k * 0.25) % 1;
          const side = k % 2 ? 1 : -1;
          return (
            <g key={k} transform={`translate(${500 + side * (60 + q * 620)} ${horizon - 40 - q * 120}) scale(${0.4 + q * 1.6})`} opacity={1 - q * 0.6}>
              <ellipse cx={0} cy={0} rx={60} ry={22} fill="#FFFFFF" />
              <ellipse cx={-34} cy={8} rx={36} ry={18} fill="#FFFFFF" />
              <ellipse cx={34} cy={6} rx={40} ry={20} fill="#FFFFFF" />
            </g>
          );
        })}
        <rect x={0} y={horizon} width={1000} height={400} fill={GRASS} />
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={60 + i * 56} y={horizon - 10 - (i % 4) * 7} width={34} height={10 + (i % 4) * 7} fill="#9AA7C2" />
        ))}
        <polygon
          points={`${500 - w0 / 2},${horizon} ${500 + w0 / 2},${horizon} ${500 + w1 / 2},${bottom} ${500 - w1 / 2},${bottom}`}
          fill="#4B4F5E"
        />
        {Array.from({ length: 9 }, (_, k) => {
          const d = ((k + t * speed) % 9) / 9;
          const y = horizon + (bottom - horizon) * d * d;
          const w = lerp(w0, w1, d * d);
          const len = 6 + 70 * d * d;
          return (
            <g key={k}>
              <rect x={500 - (3 + 10 * d)} y={y} width={6 + 20 * d} height={len} fill="#FFFFFF" />
              <circle cx={500 - w / 2 - 6} cy={y} r={2 + 8 * d} fill="#FFD23F" />
              <circle cx={500 + w / 2 + 6} cy={y} r={2 + 8 * d} fill="#FFD23F" />
            </g>
          );
        })}
      </g>
      <path d={shield} fill="none" stroke={theme.ink} strokeWidth={30} strokeLinejoin="round" />
      <rect x={488} y={250} width={24} height={470} fill={theme.ink} />
      {/* dashboard */}
      <rect x={20} y={712} width={960} height={190} rx={34} fill="#2B2E3B" />
      {[150, 300, 700, 850].map((x, i) => {
        const a = Math.sin(t * (2 + i) + i) * 40 + (i === 1 ? lerp(60, -60, p) : 0);
        return (
          <g key={x}>
            <circle cx={x} cy={800} r={52} fill="#F4F3EE" />
            <circle cx={x} cy={800} r={42} fill="none" stroke={LIVERY[i]} strokeWidth={8} strokeDasharray="40 12" />
            <line x1={x} y1={800} x2={x + Math.cos(((a - 90) * Math.PI) / 180) * 36} y2={800 + Math.sin(((a - 90) * Math.PI) / 180) * 36} stroke={theme.ink} strokeWidth={6} strokeLinecap="round" />
            <circle cx={x} cy={800} r={7} fill={theme.ink} />
          </g>
        );
      })}
      <rect x={400} y={748} width={200} height={104} rx={16} fill="#0E1A12" />
      {touch ? (
        <text x={500} y={812} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={30} fill={theme.alert} opacity={Math.sin(t * 10) > -0.2 ? 1 : 0.25}>
          GROUND STOP
        </text>
      ) : (
        <>
          <text x={500} y={784} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={20} fill="#6CFF8B">ALTITUDE</text>
          <text x={500} y={832} textAnchor="middle" fontFamily={DISPLAY} fontSize={46} fill="#6CFF8B">{alt} FT</text>
        </>
      )}
    </g>
  );
};

const Timeline: React.FC<{ enter: (d: number, damping?: number) => number; t: number }> = ({ enter, t }) => {
  const theme = useTheme();
  const cards = [
    { year: "2001", label: "9/11 ATTACKS", color: theme.slate },
    { year: "2023", label: "SYSTEM OUTAGE", color: theme.slate },
    { year: "2026", label: "NOV 13", color: theme.alert },
  ];
  const draw = clamp01((t - 0.4) / 1.1);
  return (
    <g>
      <line x1={190} y1={200} x2={190 + 620 * draw} y2={200} stroke={theme.ink} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" />
      {cards.map((c, i) => {
        const s = enter(0.3 + i * 0.4, 9);
        const x = 190 + i * 310;
        const bob = i === 2 ? Math.sin(t * 4) * 6 : 0;
        if (s <= 0.01) return null;
        return (
          <g key={c.year} transform={`translate(${x} ${200 + bob}) scale(${s}) rotate(${(i - 1) * 3})`}>
            <rect x={-122} y={-82} width={244} height={164} rx={22} fill={theme.shadow} transform="translate(0 10)" />
            <rect x={-122} y={-82} width={244} height={164} rx={22} fill={theme.card} stroke={i === 2 ? theme.alert : "none"} strokeWidth={6} />
            <rect x={-122} y={-82} width={244} height={40} rx={20} fill={c.color} />
            <text x={0} y={22} textAnchor="middle" fontFamily={DISPLAY} fontSize={74} fill={theme.ink}>{c.year}</text>
            <text x={0} y={62} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={22} fill={i === 2 ? theme.alert : theme.muted}>{c.label}</text>
          </g>
        );
      })}
    </g>
  );
};

const Tarmac: React.FC<{ t: number; enter: (d: number, damping?: number) => number }> = ({ t, enter }) => {
  const theme = useTheme();
  // Landing plane: glides in, touches down at 1.4 s, squashes, rolls to a stop.
  const fly = ease(clamp01((t - 0.15) / 1.25));
  const touched = t > 1.4;
  const roll = touched ? ease(clamp01((t - 1.4) / 1.2)) : 0;
  const x = touched ? lerp(470, 520, roll) : lerp(-180, 470, fly);
  const y = touched ? 790 : lerp(430, 790, Math.pow(fly, 1.4));
  const angle = touched ? 0 : lerp(10, -6, fly);
  const since = t - 1.4;
  const squash = touched && since < 0.6 ? Math.sin(since * 22) * 0.12 * (1 - since / 0.6) : 0;
  const blink = t % 2.6 < 0.1;
  return (
    <g>
      <rect x={-40} y={828} width={1080} height={20} rx={10} fill={theme.slateLight} opacity={0.6} />
      {[-30, 170, 370, 570, 770].map((dx) => (
        <rect key={dx} x={dx + ((t * 40) % 0)} y={834} width={110} height={8} rx={4} fill="#FFFFFF" />
      ))}
      {[150, 850].map((px, i) => (
        <g key={px}>
          <ellipse cx={px} cy={836} rx={120} ry={12} fill={theme.shadow} />
          <g transform={`translate(${px} ${790 + Math.sin(t * 2 + i) * 2}) scale(0.82)`}>
            <SidePlane color={LIVERY[i === 0 ? 1 : 3]} mood="sad" blink={blink && i === 0} />
          </g>
          <Tag x={px} y={700} text="GROUNDED" tone="alert" size={30} display rotate={i ? 7 : -7} scale={enter(1 + i * 0.45, 8)} />
        </g>
      ))}
      <ellipse cx={x} cy={836} rx={120 * (0.4 + 0.6 * fly)} ry={12} fill={theme.shadow} opacity={touched ? 1 : fly} />
      <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${0.9 * (1 + squash)} ${0.9 * (1 - squash)})`}>
        <SidePlane color={LIVERY[0]} mood={t > 2.2 ? "sad" : "happy"} blink={blink} />
      </g>
      {touched && since < 0.5
        ? [0, 1, 2].map((k) => (
            <circle key={k} cx={x - 60 - k * 26 - since * 120} cy={826 - k * 6} r={(12 + k * 6) * (1 - since * 1.6)} fill={theme.slateLight} opacity={0.8} />
          ))
        : null}
      <Tag x={520} y={690} text="GROUNDED" tone="alert" size={30} display rotate={-4} scale={enter(2.3, 8)} />
    </g>
  );
};

// ---------------------------------------------------------------- stage

export const GroundStopStage: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const hook = useBeat("hook");
  const grounded = useBeat("grounded");
  const box = useBeat("box");
  const flights = useBeat("flights");
  const stop = useBeat("stop");
  const frozen = useBeat("frozen");
  const centers = useBeat("centers");
  const talk = useBeat("talk");
  const lost = useBeat("lost");
  const fail = useBeat("fail");
  const notalk = useBeat("notalk");
  const router = useBeat("router");
  const flood = useBeat("flood");

  const cockpitOn = 1 - grounded.ramp(0, 0.35);
  const tarmacOn = grounded.ramp(0, 0.35) * (1 - box.ramp(0, 0.35));
  const timelineOn = grounded.ramp(0, 0.3) * (1 - box.ramp(0, 0.3));
  const boxOn = box.ramp(0, 0.2) * (1 - flights.ramp(0, 0.3));
  const mapOn = flights.ramp(0, 0.3) * (1 - router.ramp(0, 0.5));
  const roomOn = router.ramp(0.3, 0.8);

  // Map placement: large while it is the subject, smaller and lower once text sits on top.
  const move = lost.enter(0, 16);
  const scale = lerp(1.1, 0.92, move) * lerp(0.75, 1, flights.enter(0, 11));
  const cx = 495;
  const cy = 440;
  const tx = lerp(500, 500, move);
  const ty = lerp(400, 540, move);

  const asCenters = centers.ramp(0, 0.4);
  const failed = (i: number) => fail.on && FAIL_AT[i] !== null && fail.t >= (FAIL_AT[i] as number);
  const gap = lost.start !== undefined && notalk.start !== undefined ? (notalk.start - lost.start) / fps : 3;

  // ---- flights scene: planes on the airport routes; after the freeze they finish and vanish.
  const routePlanes = FLIGHTS.slice(0, 9).map(([a, b], i) => {
    const r = curve([AIRPORTS[a][1], AIRPORTS[a][2]], [AIRPORTS[b][1], AIRPORTS[b][2]], -0.18);
    const speed = 0.16 + (i % 3) * 0.04;
    const raw = Math.max(0, flights.t) * speed + i / 9;
    let p = raw % 1;
    let visible = flights.on;
    if (frozen.on) {
      const tf = flights.t - frozen.t;
      const k = Math.floor(tf * speed + i / 9);
      p = raw - k;
      visible = p < 1;
    }
    const [x, y] = r.at(p);
    const [nx, ny] = r.at(Math.min(1, p + 0.01));
    return { x, y, angle: (Math.atan2(ny - y, nx - x) * 180) / Math.PI, visible, color: LIVERY[i % LIVERY.length], fade: Math.sin(Math.min(1, p) * Math.PI) };
  });

  return (
    <g>
      {/* ---------------- HOOK: pilot's view ---------------- */}
      {cockpitOn > 0.01 ? (
        <g opacity={cockpitOn}>
          <Cockpit t={Math.max(0, hook.t)} p={hook.ramp(0, 4.2)} />
        </g>
      ) : null}

      {/* ---------------- GROUNDED: timeline + parked planes ---------------- */}
      {grounded.on && tarmacOn + timelineOn > 0.01 ? (
        <g>
          <g opacity={timelineOn}>
            <Timeline enter={grounded.enter} t={grounded.t} />
          </g>
          <g opacity={tarmacOn}>
            <Tarmac t={grounded.t} enter={grounded.enter} />
          </g>
        </g>
      ) : null}

      {/* ---------------- BOX: the culprit ---------------- */}
      {boxOn > 0.01 ? (
        <g opacity={boxOn}>
          <polygon points={`420,0 580,0 760,${830} 240,${830}`} fill={theme.accent} opacity={0.08 + 0.04 * Math.sin(box.t * 3)} />
          {(() => {
            const drop = box.enter(0.05, 7);
            const sq = Math.max(-0.18, Math.min(0.18, drop - 1));
            return (
              <g transform={`translate(500 ${lerp(-260, 600, Math.min(drop, 1))}) scale(${1.3 * (1 + sq)} ${1.3 * (1 - sq)})`}>
                <RouterBox color="#F5B700" mood="curious" t={box.t} lights={theme.accent} />
              </g>
            );
          })()}
          {[0, 1, 2].map((k) => {
            const a = box.t * 1.6 + (k * Math.PI * 2) / 3;
            return (
              <text key={k} x={500 + Math.cos(a) * 330} y={380 + Math.sin(a) * 80} textAnchor="middle" fontFamily={DISPLAY} fontSize={70} fill={LIVERY[k + 2]} opacity={box.ramp(0.4 + k * 0.2, 0.7 + k * 0.2)}>
                ?
              </text>
            );
          })}
        </g>
      ) : null}

      {/* ---------------- MAP ---------------- */}
      {mapOn > 0.01 ? (
        <g opacity={mapOn} transform={`translate(${tx} ${ty}) scale(${scale}) translate(${-cx} ${-cy})`}>
          <polygon points={US.map((p) => p.join(",")).join(" ")} fill={theme.card} />
          <polygon points={US.map((p) => p.join(",")).join(" ")} fill="none" stroke={theme.slateLight} strokeWidth={5} strokeLinejoin="round" />

          {/* airport network */}
          {asCenters < 1
            ? FLIGHTS.map(([a, b], i) => {
                const r = curve([AIRPORTS[a][1], AIRPORTS[a][2]], [AIRPORTS[b][1], AIRPORTS[b][2]], -0.18);
                const grow = flights.ramp(0.15 + i * 0.05, 0.6 + i * 0.05);
                const gone = frozen.ramp(0.1 + (i % 8) * 0.12, 0.5 + (i % 8) * 0.12);
                return (
                  <path
                    key={i}
                    d={r.d}
                    fill="none"
                    stroke={theme.accent}
                    strokeWidth={3}
                    strokeDasharray="9 9"
                    strokeDashoffset={-t * 40}
                    pathLength={undefined}
                    opacity={grow * (1 - gone) * 0.75 * (1 - asCenters)}
                  />
                );
              })
            : null}
          {asCenters < 1
            ? routePlanes.map((pl, i) =>
                pl.visible ? <MapPlane key={i} x={pl.x} y={pl.y} angle={pl.angle} color={pl.color} scale={0.8} opacity={pl.fade * (1 - asCenters)} /> : null,
              )
            : null}
          {asCenters < 1
            ? AIRPORTS.map(([name, x, y], i) => {
                const flipAt = 0.25 + i * 0.09;
                const red = frozen.on && frozen.t > flipAt;
                const bump = red ? 1 + 0.6 * Math.max(0, 1 - (frozen.t - flipAt) / 0.3) : 1;
                const pop = flights.enter(0.05 + i * 0.03, 10);
                const color = red ? theme.alert : theme.accent;
                return (
                  <g key={name} opacity={1 - asCenters} transform={`translate(${x} ${y}) scale(${pop * bump})`}>
                    <circle r={18} fill={color} opacity={0.18} />
                    <circle r={10} fill={color} />
                    {LABELED.has(name) ? (
                      <text y={-20} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={20} fill={theme.ink}>
                        {name}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}

          {/* control-center network */}
          {asCenters > 0
            ? LINKS.map(([a, b], i) => {
                const grow = talk.enter(0.2 + i * 0.06, 18);
                if (grow <= 0.01) return null;
                const times = [FAIL_AT[a], FAIL_AT[b]].filter((v): v is number => v !== null);
                const breakAt = times.length ? Math.min(...times) : null;
                const cut = breakAt !== null && fail.on ? clamp01((fail.t - breakAt) / 0.45) : 0;
                const [x1, y1] = CENTERS[a];
                const [x2, y2] = CENTERS[b];
                const mx = lerp(x1, x2, 0.5);
                const my = lerp(y1, y2, 0.5);
                const half = 0.5 * (1 - cut);
                return (
                  <g key={i} opacity={asCenters}>
                    {cut === 0 ? (
                      <line x1={x1} y1={y1} x2={lerp(x1, x2, grow)} y2={lerp(y1, y2, grow)} stroke={theme.accent} strokeWidth={5} strokeLinecap="round" />
                    ) : (
                      <>
                        <line x1={x1} y1={y1} x2={lerp(x1, x2, half)} y2={lerp(y1, y2, half)} stroke={theme.accent} strokeWidth={5} strokeLinecap="round" opacity={1 - cut * 0.6} />
                        <line x1={x2} y1={y2} x2={lerp(x2, x1, half)} y2={lerp(y2, y1, half)} stroke={theme.accent} strokeWidth={5} strokeLinecap="round" opacity={1 - cut * 0.6} />
                        {cut < 1 ? <circle cx={mx} cy={my} r={16 * (1 - cut)} fill={theme.alert} /> : null}
                      </>
                    )}
                  </g>
                );
              })
            : null}
          {asCenters > 0
            ? SKY_PLANES.map((pl, i) => {
                const from = CENTERS[pl.a];
                const to = CENTERS[pl.b];
                const r = curve(from, to, 0.12);
                const p = (Math.max(0, centers.t) * pl.speed + pl.offset) % 1;
                const [x, y] = r.at(p);
                const [nx, ny] = r.at(Math.min(1, p + 0.01));
                const appear = centers.enter(0.25 + i * 0.04, 12);
                const vanishAt = (i / SKY_PLANES.length) * gap * 0.9;
                const vanish = notalk.on ? 0 : lost.on ? 1 - clamp01((lost.t - vanishAt) / 0.4) : 1;
                const o = appear * vanish * asCenters;
                return o > 0.01 ? <MapPlane key={i} x={x} y={y} angle={(Math.atan2(ny - y, nx - x) * 180) / Math.PI} color={pl.color} scale={0.75} opacity={o} /> : null;
              })
            : null}
          {asCenters > 0
            ? CENTERS.map(([x, y], i) => {
                const red = failed(i);
                const color = red ? theme.alert : theme.accent;
                const pop = centers.enter(0.1 + i * 0.035, 9);
                const flipBump = red ? 1 + 0.7 * Math.max(0, 1 - (fail.t - (FAIL_AT[i] as number)) / 0.3) : 1;
                const ring = (t * 0.9 + i * 0.37) % 1;
                const loud = red && notalk.on;
                const bubble = !red && talk.on && i % 3 === 0 ? (talk.t * 0.7 + i * 0.29) % 1 : 1;
                return (
                  <g key={i} opacity={asCenters} transform={`translate(${x} ${y})`}>
                    <circle r={(loud ? 16 : 12) + ring * (loud ? 44 : 26)} fill="none" stroke={color} strokeWidth={loud ? 5 : 3} opacity={(1 - ring) * 0.8} />
                    {loud ? <circle r={24 + Math.sin(t * 6 + i) * 4} fill={theme.alert} opacity={0.22} /> : null}
                    <circle r={12 * pop * flipBump} fill={color} />
                    <circle r={4.5 * pop} fill="#FFFFFF" />
                    {bubble < 0.55 ? (
                      <g transform={`translate(14 -30) scale(${Math.min(1, bubble * 8) * (1 - Math.max(0, bubble - 0.45) * 10)})`}>
                        <rect x={-4} y={-26} width={52} height={30} rx={14} fill={theme.card} stroke={theme.ink} strokeWidth={3} />
                        <polygon points="2,2 12,2 -2,12" fill={theme.ink} />
                        {[0, 1, 2].map((d) => (
                          <circle key={d} cx={10 + d * 13} cy={-11} r={3.5} fill={theme.ink} opacity={Math.sin(t * 8 - d) > 0 ? 1 : 0.35} />
                        ))}
                      </g>
                    ) : null}
                  </g>
                );
              })
            : null}
        </g>
      ) : null}

      {/* clock for the freeze */}
      {stop.on && centers.ramp(0, 0.3) < 1 ? (
        <g transform={`translate(820 70) scale(${stop.enter(0.1, 9)})`} opacity={1 - centers.ramp(0, 0.3)}>
          <rect x={-150} y={-62} width={300} height={124} rx={26} fill={theme.shadow} transform="translate(0 8)" />
          <rect x={-150} y={-62} width={300} height={124} rx={26} fill={theme.card} stroke={theme.alert} strokeWidth={5} />
          <circle cx={-92} cy={0} r={40} fill={theme.alert} />
          <circle cx={-92} cy={0} r={32} fill="#FFFFFF" />
          <line x1={-92} y1={0} x2={-92 + Math.cos(stop.t * 6) * 24} y2={Math.sin(stop.t * 6) * 24} stroke={theme.ink} strokeWidth={5} strokeLinecap="round" />
          <line x1={-92} y1={0} x2={-92 + Math.cos(stop.t * 0.5 - 1) * 15} y2={Math.sin(stop.t * 0.5 - 1) * 15} stroke={theme.ink} strokeWidth={6} strokeLinecap="round" />
          <text x={-36} y={-8} fontFamily={DISPLAY} fontSize={44} fill={theme.ink}>3:54 PM</text>
          <text x={-36} y={34} fontFamily={BODY} fontWeight={900} fontSize={24} fill={theme.alert}>
            {frozen.on ? `+${Math.min(4, Math.floor(frozen.t * 1.6) + 1)}${frozen.t * 1.6 >= 3 ? "+" : ""} HRS STOPPED` : "EASTERN TIME"}
          </text>
        </g>
      ) : null}

      {/* ---------------- REMOTE SITE ---------------- */}
      {roomOn > 0.01 ? <RemoteSite t={t} router={router} flood={flood} opacity={roomOn} /> : null}
    </g>
  );
};

const HUB = [520, 430];
const NODES = [
  [760, 170], [900, 300], [930, 470], [820, 640], [620, 700], [560, 150],
];

const RemoteSite: React.FC<{
  t: number;
  router: ReturnType<typeof useBeat>;
  flood: ReturnType<typeof useBeat>;
  opacity: number;
}> = ({ t, router, flood, opacity }) => {
  const theme = useTheme();
  const swap = router.ramp(1.6, 3);
  const shake = flood.on ? Math.sin(t * 60) * 4 * Math.min(1, flood.t) : 0;
  return (
    <g opacity={opacity} transform="translate(-60 120) scale(1.12)">
      {NODES.map(([x, y], i) => {
        const hit = flood.enter(0.9 + i * 0.35, 9);
        return (
          <g key={i}>
            <line x1={HUB[0]} y1={HUB[1]} x2={x} y2={y} stroke={theme.slate} strokeWidth={5} />
            {flood.on
              ? Array.from({ length: 6 }, (_, k) => {
                  const q = (t * 1.6 + k / 6 + i * 0.13) % 1;
                  return <circle key={k} cx={lerp(HUB[0], x, q)} cy={lerp(HUB[1], y, q)} r={8} fill={theme.alert} opacity={Math.min(1, flood.t * 2)} />;
                })
              : null}
            <circle cx={x} cy={y} r={30 + hit * 6} fill={hit > 0.5 ? theme.alert : theme.accent} />
            <circle cx={x} cy={y} r={11} fill={theme.bg} />
          </g>
        );
      })}
      <line x1={-20} y1={HUB[1] + 24} x2={lerp(340, -20, swap)} y2={HUB[1] + 24} stroke="#C77B3A" strokeWidth={16} strokeLinecap="round" />
      <line x1={-20} y1={HUB[1] - 24} x2={lerp(-20, 340, swap)} y2={HUB[1] - 24} stroke={theme.accent} strokeWidth={12} strokeLinecap="round" />
      <Tag x={150} y={HUB[1] + 78} text="COPPER" size={30} scale={router.enter(0.9, 10) * (1 - swap)} />
      <Tag x={150} y={HUB[1] - 78} text="FIBER" tone="accent" size={34} scale={router.enter(2.2, 9)} />
      <g transform={`translate(${HUB[0] + shake} ${HUB[1]})`}>
        <RouterBox color={theme.slate} mood={flood.on ? "panic" : "happy"} t={t} lights={flood.on ? theme.alert : theme.accent} />
      </g>
      <Tag x={HUB[0]} y={HUB[1] + 138} text="ONE ROUTER" size={40} display scale={router.enter(0.5, 9)} tone={flood.on ? "alert" : "dark"} />
      <g opacity={1 - flood.ramp(0, 0.4)}>
        <Person x={200} ground={690} h={150} color={theme.ink} hat />
        <Tag x={250} y={732} text="CONTRACTOR: L3HARRIS" size={30} scale={router.enter(1.2, 10)} />
      </g>
      <Tag x={430} y={255} text="1,000+ REQUESTS EVERY 5 SEC" tone="alert" size={34} scale={flood.enter(0.5, 8)} />
    </g>
  );
};
