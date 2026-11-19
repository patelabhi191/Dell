import React, { useContext, useMemo } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BeatsContext } from "../beats";
import { BigStat, Checklist, Disclaimer, K, KitDefs, MONO, TitleCard } from "../kit";
import { BODY } from "../theme";
import { WarmUp, logRenderer } from "../three/common";
import { EventPopups, EventSet, SET_SHOTS } from "./outage-sets";

/**
 * Episode 007 "The week everything went down": one isometric 3D world (R3/R4 look: slate
 * blocks lit from above on a dark grid, cyan edge strips, red only for failures) with R1-style
 * energy (pulse rings, spark bursts, packets, a camera that never stops). Each outage is a
 * district of "outage city" wired to a central hub; districts go red in date order, show
 * amber scaffolding for upgrades, and turn green when restored.
 *
 * Rendered with @remotion/three on the GPU (orthographic camera = true isometric). The HUD and
 * labels are the SVG kit, pinned to 3D points by projecting through the same camera.
 */

const W = 1080;
const H = 1920;
const FPS = 30;

const P = {
  bg: "#0D131C",
  floor: "#111924",
  grid1: "#1E2A3A",
  grid2: "#172131",
  slate: "#243042",
  slate2: "#2E3C52",
  light: "#D8DEE8",
  cyan: K.cyan,
  red: K.red,
  amber: K.amber,
  green: K.green,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Beats = Record<string, number>;
const since = (beats: Beats, frame: number, name: string) => (beats[name] === undefined ? -999 : (frame - beats[name]) / FPS);

// ---------------------------------------------------------------- the city
/** In story (date) order: the counter and the date timeline follow this order. */
type District = { id: string; beat: string; hit?: string; x: number; z: number; tag: string; date: string; name: string };
const DISTRICTS: District[] = [
  { id: "microsoft", beat: "microsoft", x: 0.2, z: -4.6, tag: "MICROSOFT 365", date: "NOV 12", name: "MICROSOFT 365" },
  { id: "faa", beat: "faa", hit: "faaHit", x: -4.3, z: -3.0, tag: "FAA · AIR TRAFFIC CONTROL", date: "NOV 13", name: "FAA GROUND STOP" },
  { id: "banks", beat: "banks", x: 4.5, z: -2.6, tag: "CHASE · SOFTWARE BUG", date: "NOV 16", name: "CHASE · ZELLE" },
  { id: "united", beat: "united", x: -4.7, z: 1.9, tag: "UNITED · DEPARTURES", date: "NOV 16", name: "UNITED AIRLINES" },
  { id: "nsa", beat: "nsa", x: 4.7, z: 2.1, tag: "NSA · CLASSIFIED NETWORK", date: "NOV 17", name: "NSA NETWORK" },
  { id: "apple", beat: "apple", x: -1.5, z: 4.7, tag: "APPLE · INTERNAL UPDATE", date: "NOV 17", name: "APPLE SERVICES" },
  { id: "sony", beat: "sony", x: 2.7, z: 4.9, tag: "PLAYSTATION NETWORK", date: "NOV 18", name: "PLAYSTATION NETWORK" },
];
const HUB = { x: 0, z: 0.1 };
const TOP: Record<string, number> = { faa: 2.1, microsoft: 2.6, banks: 1.3, united: 1.1, nsa: 1.3, apple: 1.1, sony: 1.6 };

/** Hook montage: after the title, one quick cut per outage while the counter races to 07. */
const MONTAGE_START = 1.3;
const MONTAGE_CUT = 0.45;

type State = "ok" | "down" | "upgrade" | "restored";
type DState = { state: State; age: number; scaffold: number };

/** State of district i at this frame. Priority: restored > upgrade > its own outage > reset > hook preview. */
const stateOf = (i: number, beats: Beats, frame: number): DState => {
  const d = DISTRICTS[i];
  const tHook = since(beats, frame, "hook");
  const tImagine = since(beats, frame, "imagine");
  const tOwn = since(beats, frame, d.hit ?? d.beat) - (d.hit ? 0 : 0.35);
  const tUp = since(beats, frame, "upgrades") - i * 0.12;
  const tBack = since(beats, frame, "callback") - 0.4 - i * 0.22;
  const tEnd = since(beats, frame, "end");
  if (tEnd >= 0) {
    // "Will it continue?": districts flicker back to red one after another, with sparks.
    const step = tEnd * 2.6;
    const pick = Math.floor(random(`flk${Math.floor(step)}`) * DISTRICTS.length);
    if (pick === i && step % 1 < 0.6) return { state: "down", age: (step % 1) / 2.6, scaffold: 0 };
  }
  if (tBack >= 0) return { state: "restored", age: tBack, scaffold: 0 };
  if (tUp >= 0) return { state: "upgrade", age: tUp, scaffold: smooth(ramp(tUp, 0, 0.5)) };
  if (tImagine >= 0) {
    if (tOwn >= 0) return { state: "down", age: tOwn, scaffold: 0 };
    // Imagine: every building gets scaffolding (being rewired), until its own outage.
    return { state: "ok", age: tImagine, scaffold: smooth(ramp(tImagine, 0.15 + i * 0.08, 0.7 + i * 0.08)) };
  }
  // Hook montage: all seven fall in quick succession.
  const tFall = tHook - MONTAGE_START - i * MONTAGE_CUT - 0.08;
  if (tFall >= 0) return { state: "down", age: tFall, scaffold: 0 };
  return { state: "ok", age: tHook, scaffold: 0 };
};
const colorOf = (s: State) => (s === "down" ? P.red : s === "upgrade" ? P.amber : s === "restored" ? P.green : P.cyan);

// ---------------------------------------------------------------- camera (orthographic iso)
type Shot = { x: number; z: number; zoom: number; az: number; y?: number };
type Pair = [Shot, Shot];
const D = (id: string) => DISTRICTS.find((d) => d.id === id)!;
const at = (id: string, zoom: number, az: number, dz = 0): Shot => ({ x: D(id).x, z: D(id).z + dz, zoom, az });
const SHOTS: Record<string, Pair> = {
  hook: [{ x: 0, z: 0.6, zoom: 68, az: 40 }, { x: 0, z: 0.4, zoom: 80, az: 52 }],
  question: [{ x: HUB.x, z: HUB.z, zoom: 120, az: 52 }, { x: HUB.x, z: HUB.z, zoom: 140, az: 40 }],
  imagine: [{ x: 0, z: 0.4, zoom: 80, az: 34 }, { x: 0, z: 0.4, zoom: 72, az: 46 }],
  here: [{ x: 0, z: -1.6, zoom: 85, az: 46 }, { x: 0.1, z: -3.6, zoom: 130, az: 44 }],
  microsoft: [at("microsoft", 175, 52), at("microsoft", 200, 40)],
  faa: [at("faa", 185, 42), at("faa", 215, 54)],
  banks: [at("banks", 180, 44), at("banks", 205, 32)],
  united: [at("united", 190, 36), at("united", 215, 50)],
  nsa: [at("nsa", 190, 52), at("nsa", 215, 40)],
  apple: [at("apple", 195, 40), at("apple", 220, 54)],
  sony: [at("sony", 190, 54), at("sony", 215, 42)],
  twist: [{ x: 0, z: 0.5, zoom: 78, az: 44 }, { x: 0, z: 0.5, zoom: 70, az: 60 }],
  callback: [{ x: 0, z: 0.5, zoom: 70, az: 60 }, { x: 0, z: 0.5, zoom: 82, az: 44 }],
  end: [{ x: 0, z: 0.5, zoom: 84, az: 44 }, { x: 0, z: 0.5, zoom: 70, az: 30 }],
};
const ORDER = Object.keys(SHOTS);
const lerpShot = (a: Shot, b: Shot, t: number): Shot => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
  zoom: a.zoom + (b.zoom - a.zoom) * t,
  az: a.az + (b.az - a.az) * t,
  y: (a.y ?? 0.4) + ((b.y ?? 0.4) - (a.y ?? 0.4)) * t,
});
const TRANSITION = 0.7;
const CITY_BEATS = new Set(["question", "imagine", "here", "twist", "callback", "end"]);

/** Seconds into each event beat when its failure lands (matches the narration). */
const FAIL_AT: Record<string, number> = { microsoft: 1.5, banks: 1.6, united: 1.4, nsa: 2.0, apple: 1.3, sony: 1.7 };

type Mode = { set: string | null; t: number; f: number; g: number; montage: boolean; dur: number; cutAt: number; cut: boolean };
const beatNow = (beats: Beats, frame: number) => {
  let cur = ORDER[0];
  ORDER.forEach((b) => {
    if (beats[b] !== undefined && frame >= beats[b]) cur = b;
  });
  return cur;
};
/** What fills the screen: the city, or one event set with its own timings. */
const modeAt = (beats: Beats, frame: number, total: number): Mode => {
  const cur = beatNow(beats, frame);
  const start = beats[cur] ?? 0;
  const tc = (frame - start) / FPS;
  if (cur === "hook" && tc >= MONTAGE_START) {
    const k = Math.min(DISTRICTS.length - 1, Math.floor((tc - MONTAGE_START) / MONTAGE_CUT));
    const local = tc - MONTAGE_START - k * MONTAGE_CUT;
    return { set: DISTRICTS[k].id, t: local + 0.6, f: local - 0.08, g: local, montage: true, dur: MONTAGE_CUT, cutAt: start + (MONTAGE_START + k * MONTAGE_CUT) * FPS, cut: true };
  }
  const d = DISTRICTS.find((x) => x.beat === cur);
  if (d) {
    const nx = ORDER.slice(ORDER.indexOf(cur) + 1).find((b) => beats[b] !== undefined);
    const end = nx ? beats[nx] : total;
    const f = d.id === "faa" ? since(beats, frame, "faaHit") : tc - FAIL_AT[d.id];
    const g = d.id === "faa" ? since(beats, frame, "grounded") : d.id === "banks" ? since(beats, frame, "zelle") : -1;
    return { set: d.id, t: tc, f, g, montage: false, dur: (end - start) / FPS, cutAt: start, cut: true };
  }
  return { set: null, t: tc, f: 0, g: 0, montage: false, dur: 0, cutAt: start, cut: cur === "question" || cur === "twist" };
};

const shotAt = (beats: Beats, frame: number, total: number): Shot => {
  const m = modeAt(beats, frame, total);
  if (m.set) {
    const [a, b] = SET_SHOTS[m.set];
    return lerpShot(a, b, Easing.inOut(Easing.quad)(clamp01((frame - m.cutAt) / FPS / Math.max(0.1, m.dur))));
  }
  let i = 0;
  ORDER.forEach((b, k) => {
    if (beats[b] !== undefined && frame >= beats[b]) i = k;
  });
  const within = (f: number, k: number) => {
    const s = beats[ORDER[k]] ?? 0;
    const nx = ORDER.slice(k + 1).find((b) => beats[b] !== undefined);
    const e = nx ? beats[nx] : total;
    return lerpShot(SHOTS[ORDER[k]][0], SHOTS[ORDER[k]][1], Easing.inOut(Easing.quad)(clamp01((f - s) / Math.max(1, e - s))));
  };
  const here = within(frame, i);
  const local = (frame - (beats[ORDER[i]] ?? 0)) / FPS;
  // Ease between city shots only; coming from an event set (or the montage) is a hard cut.
  if (i === 0 || local >= TRANSITION || !CITY_BEATS.has(ORDER[i - 1])) return here;
  const prev = within(beats[ORDER[i]], i - 1);
  const u = Easing.inOut(Easing.cubic)(local / TRANSITION);
  // Zoom eases in log space so pull-outs and push-ins feel even.
  const z = Math.exp(Math.log(prev.zoom) + (Math.log(here.zoom) - Math.log(prev.zoom)) * u);
  return { ...lerpShot(prev, here, u), zoom: z };
};

const EL = Math.atan(1 / Math.SQRT2); // true isometric elevation (35.26 deg)
const camPose = (s: Shot) => {
  const a = (s.az * Math.PI) / 180;
  const dir = v3(Math.sin(a) * Math.cos(EL), Math.sin(EL), Math.cos(a) * Math.cos(EL));
  const target = v3(s.x, s.y ?? 0.4, s.z);
  return { pos: target.clone().add(dir.multiplyScalar(40)), target, zoom: s.zoom };
};

// ---------------------------------------------------------------- 3D parts
const glow = (color: string, intensity: number, opacity = 1) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
);
const Slate: React.FC<{ top?: boolean }> = ({ top }) => <meshStandardMaterial color={top ? P.slate2 : P.slate} roughness={0.72} metalness={0.15} />;

/** A box with lit slate faces that casts and receives shadows. */
const Block: React.FC<{ p: [number, number, number]; s: [number, number, number]; light?: boolean; rot?: number }> = ({ p, s, light, rot = 0 }) => (
  <mesh position={p} rotation={[0, rot, 0]} castShadow receiveShadow>
    <boxGeometry args={s} />
    {light ? <meshStandardMaterial color={P.light} roughness={0.5} metalness={0.1} /> : <Slate />}
  </mesh>
);

/** Platform tile with glowing edge strips in the district's state colour. */
const Platform: React.FC<{ color: string; pulse: number }> = ({ color, pulse }) => {
  const s = 2.7;
  const e = 0.045;
  const k = 1.6 + pulse * 2.5;
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[s, 0.12, s]} />
        <meshStandardMaterial color="#1A2433" roughness={0.8} metalness={0.1} />
      </mesh>
      {[
        [0, s / 2, s, e],
        [0, -s / 2, s, e],
        [s / 2, 0, e, s],
        [-s / 2, 0, e, s],
      ].map(([x, z, w, d], k2) => (
        <mesh key={k2} position={[x, 0.125, z]}>
          <boxGeometry args={[w, 0.02, d]} />
          {glow(color, k)}
        </mesh>
      ))}
    </group>
  );
};

/** Amber scaffolding (wire box) around a district: "being rewired". */
const Scaffold: React.FC<{ h: number; amount: number }> = ({ h, amount }) => {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(2.3, 1, 2.3, 2, 3, 2)), []);
  if (amount <= 0.01) return null;
  return (
    <lineSegments geometry={geo} position={[0, (h * amount) / 2 + 0.12, 0]} scale={[1, h * amount, 1]}>
      <lineBasicMaterial color={P.amber} transparent opacity={0.85 * amount} toneMapped={false} />
    </lineSegments>
  );
};

/** Floating status diamond plus R1-style pulse ring and spark burst when a district fails. */
const Beacon: React.FC<{ id: string; y: number; st: DState; frame: number }> = ({ id, y, st, frame }) => {
  const color = colorOf(st.state);
  const fresh = st.state === "down" || st.state === "restored" ? clamp01(1 - st.age / 1.4) : 0;
  const bob = Math.sin(frame * 0.08 + id.length) * 0.06;
  const sparks = useMemo(
    () =>
      Array.from({ length: 36 }, (_, k) => ({
        a: random(`${id}sa${k}`) * Math.PI * 2,
        r: 0.6 + random(`${id}sr${k}`) * 1.4,
        up: 0.8 + random(`${id}su${k}`) * 1.8,
      })),
    [id],
  );
  return (
    <group>
      <mesh position={[0, y + 0.45 + bob, 0]} rotation={[0, frame * 0.04, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        {glow(color, 3.5)}
      </mesh>
      {fresh > 0 ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]} scale={1 + (1 - fresh) * 2.6}>
            <ringGeometry args={[1.3, 1.42, 64]} />
            {glow(color, 3, fresh)}
          </mesh>
          {sparks.map((s, k) => {
            const t = 1 - fresh;
            return (
              <mesh key={k} position={[Math.cos(s.a) * s.r * t, y * 0.6 + s.up * t - 1.2 * t * t, Math.sin(s.a) * s.r * t]}>
                <boxGeometry args={[0.035, 0.035, 0.035]} />
                {glow(color, 5, fresh)}
              </mesh>
            );
          })}
        </>
      ) : null}
    </group>
  );
};

const Windows: React.FC<{ w: number; h: number; d: number; y0: number; rows: number; cols: number; color: string; on: number; seed: string }> = ({
  w,
  h,
  d,
  y0,
  rows,
  cols,
  color,
  on,
  seed,
}) => (
  <group>
    {Array.from({ length: rows * cols * 2 }, (_, k) => {
      const face = k < rows * cols ? 0 : 1;
      const idx = k % (rows * cols);
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const lit = random(`${seed}${k}`) < on;
      const y = y0 + ((r + 0.5) / rows) * h;
      const u = ((c + 0.5) / cols - 0.5) * (face === 0 ? d : w) * 0.8;
      const pos: [number, number, number] = face === 0 ? [w / 2 + 0.004, y, u] : [u, y, d / 2 + 0.004];
      return (
        <mesh key={k} position={pos} rotation={[0, face === 0 ? Math.PI / 2 : 0, 0]}>
          <planeGeometry args={[((face === 0 ? d : w) / cols) * 0.5, (h / rows) * 0.45]} />
          {lit ? glow(color, 1.6) : <meshStandardMaterial color="#141C28" roughness={0.6} />}
        </mesh>
      );
    })}
  </group>
);

const Plane: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <group scale={s}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
      <capsuleGeometry args={[0.05, 0.4, 4, 10]} />
      <meshStandardMaterial color={P.light} roughness={0.45} />
    </mesh>
    <mesh position={[0, 0, 0.02]} castShadow>
      <boxGeometry args={[0.56, 0.018, 0.11]} />
      <meshStandardMaterial color={P.light} roughness={0.45} />
    </mesh>
    <mesh position={[0, 0.06, -0.22]} castShadow>
      <boxGeometry args={[0.018, 0.13, 0.09]} />
      <meshStandardMaterial color={P.light} roughness={0.45} />
    </mesh>
    <mesh position={[0, 0.005, -0.22]}>
      <boxGeometry args={[0.2, 0.014, 0.06]} />
      <meshStandardMaterial color={P.light} roughness={0.45} />
    </mesh>
  </group>
);

// District models (local coordinates, platform top at y = 0.12)
const FAA: React.FC<{ color: string; down: boolean; frame: number; tHit: number }> = ({ color, down, frame, tHit }) => {
  const flood = tHit >= 0 && tHit < 4;
  return (
    <group>
      <mesh position={[-0.5, 0.12 + 0.8, 0.3]} castShadow>
        <cylinderGeometry args={[0.13, 0.17, 1.6, 12]} />
        <Slate />
      </mesh>
      <mesh position={[-0.5, 1.85, 0.3]} castShadow>
        <cylinderGeometry args={[0.36, 0.28, 0.32, 8]} />
        <Slate top />
      </mesh>
      <mesh position={[-0.5, 1.85, 0.3]}>
        <cylinderGeometry args={[0.365, 0.29, 0.14, 8, 1, true]} />
        {glow(color, 2.2)}
      </mesh>
      <mesh position={[-0.5, 2.06, 0.3]} castShadow>
        <cylinderGeometry args={[0.3, 0.38, 0.08, 8]} />
        <Slate top />
      </mesh>
      {/* runway */}
      <mesh position={[0.35, 0.13, -0.55]} rotation={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[2.3, 0.02, 0.42]} />
        <meshStandardMaterial color="#1B2230" roughness={0.9} />
      </mesh>
      {Array.from({ length: 7 }, (_, k) => (
        <mesh key={k} position={[0.35 + (k - 3) * 0.3 * Math.cos(-0.25), 0.145, -0.55 - (k - 3) * 0.3 * Math.sin(-0.25)]} rotation={[0, -0.25, 0]}>
          <boxGeometry args={[0.14, 0.005, 0.03]} />
          {glow("#E8F1FF", 1.5)}
        </mesh>
      ))}
      {/* planes parked on the apron (held on the ground) */}
      {[-0.2, 0.35, 0.9].map((x, k) => (
        <group key={k} position={[x, 0.17, 0.55]} rotation={[0, Math.PI * 0.95, 0]}>
          <Plane s={0.9} />
        </group>
      ))}
      {/* the router */}
      <group position={[0.8, 0.12, 0.05]}>
        <Block p={[0, 0.07, 0]} s={[0.36, 0.14, 0.26]} />
        {Array.from({ length: 5 }, (_, k) => (
          <mesh key={k} position={[-0.12 + k * 0.06, 0.09, 0.132]}>
            <boxGeometry args={[0.025, 0.02, 0.005]} />
            {glow(down ? (Math.sin(frame * 1.3 + k) > 0 ? P.red : P.amber) : P.green, 4)}
          </mesh>
        ))}
        {flood
          ? Array.from({ length: 22 }, (_, k) => {
              const a = (k / 22) * Math.PI * 2;
              const u = (tHit * 1.4 + k * 0.137) % 1;
              return (
                <mesh key={k} position={[Math.cos(a) * u * 1.6, 0.12 + Math.sin(u * Math.PI) * 0.5, Math.sin(a) * u * 1.6]}>
                  <boxGeometry args={[0.05, 0.05, 0.05]} />
                  {glow(P.red, 5, 1 - u * 0.6)}
                </mesh>
              );
            })
          : null}
      </group>
    </group>
  );
};

const Microsoft: React.FC<{ color: string; down: boolean }> = ({ color, down }) => (
  <group>
    <Block p={[0, 0.12 + 1.2, 0]} s={[1.1, 2.4, 1.1]} />
    <Block p={[0, 2.48, 0]} s={[1.18, 0.08, 1.18]} />
    <Windows w={1.1} h={2.1} d={1.1} y0={0.25} rows={7} cols={4} color={down ? P.red : "#BFEFFF"} on={down ? 0.12 : 0.75} seed="ms" />
    <mesh position={[0, 2.53, 0]}>
      <boxGeometry args={[0.9, 0.02, 0.9]} />
      {glow(color, 2)}
    </mesh>
    <Block p={[0.75, 0.12 + 0.35, 0.6]} s={[0.5, 0.7, 0.5]} />
  </group>
);

const Bank: React.FC<{ s?: number; color: string }> = ({ s = 1, color }) => (
  <group scale={s}>
    <Block p={[0, 0.17, 0]} s={[0.9, 0.1, 0.7]} />
    {[-0.3, -0.1, 0.1, 0.3].map((x) => (
      <mesh key={x} position={[x, 0.47, 0.26]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color={P.light} roughness={0.5} />
      </mesh>
    ))}
    <Block p={[0, 0.47, -0.05]} s={[0.8, 0.5, 0.45]} />
    <Block p={[0, 0.76, 0]} s={[0.92, 0.08, 0.72]} light />
    <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.2, 0.2, 0.9, 3]} />
      <meshStandardMaterial color={P.light} roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.8, 0.365]}>
      <boxGeometry args={[0.7, 0.025, 0.01]} />
      {glow(color, 2.4)}
    </mesh>
  </group>
);

const ZELLE_A = [new THREE.QuadraticBezierCurve3(v3(-0.85, 0.5, 0.75), v3(-0.4, 1.3, 0.3), v3(0, 0.9, -0.1)), new THREE.QuadraticBezierCurve3(v3(0.85, 0.5, 0.75), v3(0.4, 1.3, 0.3), v3(0, 0.9, -0.1))];
const Banks: React.FC<{ color: string; down: boolean; tZelle: number; t: number }> = ({ color, down, tZelle, t }) => (
  <group>
    <group position={[0, 0, -0.35]}>
      <Bank s={1.25} color={color} />
    </group>
    <group position={[-0.85, 0, 0.75]}>
      <Bank s={0.75} color={P.cyan} />
    </group>
    <group position={[0.85, 0, 0.75]}>
      <Bank s={0.75} color={P.cyan} />
    </group>
    {ZELLE_A.map((c, k) => {
      const stuck = down && tZelle >= 0;
      const col = stuck ? P.amber : P.cyan;
      return (
        <group key={k}>
          <Line points={c.getPoints(24)} color={col} lineWidth={2} dashed dashSize={0.08} gapSize={0.06} transparent opacity={0.85} />
          {[0, 0.33, 0.66].map((o) => {
            // Moving packets; once stuck they pile up just short of Chase.
            const u = stuck ? 0.62 + o * 0.12 : (t * 0.6 + o + k * 0.2) % 1;
            return (
              <mesh key={o} position={c.getPoint(u)}>
                <boxGeometry args={[0.07, 0.05, 0.05]} />
                {glow(stuck ? P.amber : "#CFF6FF", 4)}
              </mesh>
            );
          })}
        </group>
      );
    })}
  </group>
);

const United: React.FC<{ color: string; down: boolean; frame: number }> = ({ color, down, frame }) => {
  const needle = down ? Math.sin(frame * 0.6) * 1.2 : -0.6 + Math.sin(frame * 0.05) * 0.1;
  return (
    <group>
      <Block p={[-0.55, 0.12 + 0.3, -0.5]} s={[1.3, 0.6, 0.7]} />
      <mesh position={[-0.55, 0.62, -0.14]}>
        <boxGeometry args={[1.1, 0.12, 0.01]} />
        {glow(color, 1.8)}
      </mesh>
      <Block p={[0.05, 0.55, -0.05]} s={[0.18, 0.14, 0.9]} rot={0.5} />
      <group position={[0.45, 0.32, 0.45]} rotation={[0, -0.6, 0]}>
        <Plane s={2.1} />
      </group>
      {/* weight gauge */}
      <group position={[0.9, 1.25, -0.55]} rotation={[0, Math.PI / 4, 0]}>
        <mesh>
          <torusGeometry args={[0.3, 0.025, 8, 40, Math.PI]} />
          {glow(down ? P.amber : P.cyan, 3)}
        </mesh>
        <mesh position={[Math.sin(needle) * 0.12, Math.cos(needle) * 0.12, 0.01]} rotation={[0, 0, -needle]}>
          <boxGeometry args={[0.02, 0.26, 0.02]} />
          {glow(P.light, 2)}
        </mesh>
        <mesh position={[0, -0.02, -0.02]}>
          <boxGeometry args={[0.7, 0.04, 0.03]} />
          <Slate />
        </mesh>
      </group>
    </group>
  );
};

const NSA: React.FC<{ color: string; frame: number }> = ({ color, frame }) => (
  <group>
    <Block p={[-0.2, 0.12 + 0.25, -0.2]} s={[1.5, 0.5, 1.0]} />
    <mesh position={[-0.2, 0.63, 0.31]}>
      <boxGeometry args={[1.3, 0.05, 0.01]} />
      {glow(color, 2)}
    </mesh>
    {[
      [0.75, 0.6],
      [-0.85, 0.75],
    ].map(([x, z], k) => (
      <group key={k} position={[x, 0.12, z]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.6, 8]} />
          <Slate />
        </mesh>
        <mesh position={[0, 0.66, 0]} rotation={[-0.9, frame * 0.01 + k, 0]} castShadow>
          <sphereGeometry args={[0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
          <meshStandardMaterial color={P.light} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
      </group>
    ))}
    {/* fence */}
    {Array.from({ length: 14 }, (_, k) => {
      const a = (k / 14) * Math.PI * 2;
      return (
        <mesh key={k} position={[Math.cos(a) * 1.2, 0.27, Math.sin(a) * 1.2]}>
          <boxGeometry args={[0.03, 0.3, 0.03]} />
          <Slate top />
        </mesh>
      );
    })}
    <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.19, 1.21, 64]} />
      {glow(color, 1.6, 0.8)}
    </mesh>
  </group>
);

const Apple: React.FC<{ color: string }> = ({ color }) => {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 0.9, 1.3)), []);
  return (
    <group position={[0, 0.12, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.5, 0.9, 1.3]} />
        <meshStandardMaterial color="#9FD8FF" transparent opacity={0.16} roughness={0.1} metalness={0.2} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges} position={[0, 0.45, 0]}>
        <lineBasicMaterial color={color} toneMapped={false} />
      </lineSegments>
      {[-0.35, 0.35].map((x) => (
        <group key={x}>
          <Block p={[x, 0.18, 0]} s={[0.5, 0.06, 0.3]} light />
          <Block p={[x, 0.08, 0]} s={[0.08, 0.16, 0.08]} />
        </group>
      ))}
      {/* card terminal */}
      <Block p={[0.5, 0.25, 0.5]} s={[0.12, 0.05, 0.18]} />
      <mesh position={[0.5, 0.28, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.09, 0.12]} />
        {glow(color, 3)}
      </mesh>
    </group>
  );
};

const Sony: React.FC<{ color: string; down: boolean; frame: number }> = ({ color, down, frame }) => (
  <group>
    {[0, 1, 2].map((k) => (
      <group key={k} position={[0, 0.12 + 0.24 + k * 0.42, 0]}>
        <Block p={[0, 0, 0]} s={[1.1, 0.36, 1.1]} />
        {[-0.1, 0.02, 0.14].map((y) => (
          <group key={y}>
            <mesh position={[0.555, y - 0.02, 0]}>
              <boxGeometry args={[0.01, 0.035, 0.8]} />
              {glow(color, 2.4)}
            </mesh>
            <mesh position={[0, y - 0.02, 0.555]}>
              <boxGeometry args={[0.8, 0.035, 0.01]} />
              {glow(color, 2.4)}
            </mesh>
          </group>
        ))}
      </group>
    ))}
    {/* players around the server */}
    {Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const p = v3(Math.cos(a) * 1.15, 0.2, Math.sin(a) * 1.15);
      const ok = !down || Math.sin(frame * 0.4 + k) > 0.85;
      return (
        <group key={k}>
          <mesh position={p}>
            <sphereGeometry args={[0.07, 12, 12]} />
            {glow(ok ? P.cyan : P.red, 3)}
          </mesh>
          <Line points={[p.toArray() as [number, number, number], [0, 0.6, 0]]} color={ok ? P.cyan : P.red} lineWidth={1.2} transparent opacity={ok ? 0.6 : 0.25} />
        </group>
      );
    })}
  </group>
);

const Hub: React.FC<{ frame: number }> = ({ frame }) => (
  <group position={[HUB.x, 0, HUB.z]}>
    <mesh position={[0, 0.06, 0]} receiveShadow>
      <cylinderGeometry args={[1.0, 1.0, 0.12, 48]} />
      <meshStandardMaterial color="#1A2433" roughness={0.8} />
    </mesh>
    <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.95, 1.0, 64]} />
      {glow(P.cyan, 2)}
    </mesh>
    {[0, 1, 2, 3].map((k) => (
      <group key={k} position={[0, 0.12 + 0.17 + k * 0.3, 0]}>
        <Block p={[0, 0, 0]} s={[0.75, 0.26, 0.75]} />
        <mesh position={[0.378, 0, 0]}>
          <boxGeometry args={[0.01, 0.03, 0.55]} />
          {glow(P.cyan, 2.5)}
        </mesh>
        <mesh position={[0, 0, 0.378]}>
          <boxGeometry args={[0.55, 0.03, 0.01]} />
          {glow(P.cyan, 2.5)}
        </mesh>
      </group>
    ))}
    <mesh position={[0, 1.55 + Math.sin(frame * 0.08) * 0.05, 0]} rotation={[0, frame * 0.03, 0]}>
      <torusGeometry args={[0.55, 0.02, 8, 64]} />
      {glow(P.cyan, 3)}
    </mesh>
  </group>
);

const CABLES = DISTRICTS.map((d) => {
  const a = v3(HUB.x, 0.05, HUB.z);
  const b = v3(d.x, 0.05, d.z);
  const mid = a.clone().lerp(b, 0.5);
  // Right-angle routing like a circuit board: hub -> along x -> along z.
  return new THREE.CatmullRomCurve3([a, v3(mid.x, 0.05, a.z), v3(mid.x, 0.05, b.z), b], false, "catmullrom", 0.05);
});
const CABLE_POINTS = CABLES.map((c) => c.getPoints(40));

const Cables: React.FC<{ states: DState[]; t: number }> = ({ states, t }) => (
  <group>
    {CABLES.map((c, i) => {
      const st = states[i].state;
      const col = colorOf(st);
      return (
        <group key={i}>
          <Line points={CABLE_POINTS[i]} color={col} lineWidth={2.2} transparent opacity={st === "down" ? 0.55 : 0.75} />
          {st === "down"
            ? null
            : [0, 0.25, 0.5, 0.75].map((o) => (
                <mesh key={o} position={c.getPoint((t * 0.22 + o + i * 0.07) % 1)}>
                  <boxGeometry args={[0.07, 0.04, 0.07]} />
                  {glow(st === "ok" ? "#CFF6FF" : col, 4)}
                </mesh>
              ))}
        </group>
      );
    })}
  </group>
);

const Motes: React.FC<{ frame: number }> = ({ frame }) => {
  const base = useMemo(() => {
    const b = new Float32Array(220 * 3);
    for (let k = 0; k < 220; k++) {
      b[k * 3] = (random(`mx${k}`) - 0.5) * 18;
      b[k * 3 + 1] = random(`my${k}`) * 5;
      b[k * 3 + 2] = (random(`mz${k}`) - 0.5) * 18;
    }
    return b;
  }, []);
  const pos = new Float32Array(base.length);
  for (let k = 0; k < 220; k++) {
    pos[k * 3] = base[k * 3];
    pos[k * 3 + 1] = (base[k * 3 + 1] + frame * 0.006 * (1 + (k % 3))) % 5;
    pos[k * 3 + 2] = base[k * 3 + 2];
  }
  return (
    <points key={frame}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={2.2} sizeAttenuation={false} color="#9EE6FF" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
};

const Rig: React.FC<{ shot: Shot }> = ({ shot }) => {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const { pos, target, zoom } = camPose(shot);
  camera.position.copy(pos);
  camera.zoom = zoom;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};

const World: React.FC<{ beats: Beats; frame: number; shot: Shot; mode: Mode }> = ({ beats, frame, shot, mode }) => {
  const t = frame / FPS;
  const states = DISTRICTS.map((_, i) => stateOf(i, beats, frame));
  return (
    <>
      <color attach="background" args={[P.bg]} />
      <Rig shot={shot} />
      {/* Key light from above-left (lit tops, shaded sides, soft shadows) + cool sky fill. */}
      <ambientLight color="#8EA2C8" intensity={0.35} />
      <hemisphereLight args={["#A9BEE6", "#0B1018", 0.75]} />
      <directionalLight
        position={[-7, 14, 5]}
        intensity={2.2}
        color="#F2F5FF"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={50}
      />
      <directionalLight position={[8, 6, 9]} intensity={0.45} color="#9FB8FF" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={P.floor} roughness={0.92} metalness={0.05} />
      </mesh>
      <gridHelper args={[60, 60, P.grid1, P.grid2]} position={[0, 0.003, 0]} />
      <gridHelper args={[60, 240, P.grid2, P.grid2]} position={[0, 0.002, 0]} />
      {mode.set ? <EventSet id={mode.set} t={mode.t} f={mode.f} g={mode.g} frame={frame} montage={mode.montage} /> : null}
      {mode.set ? null : <Cables states={states} t={t} />}
      {mode.set ? null : <Hub frame={frame} />}
      {mode.set ? null : DISTRICTS.map((d, i) => {
        const st = states[i];
        const color = colorOf(st.state);
        const down = st.state === "down";
        const pulse = down ? 0.5 + 0.5 * Math.abs(Math.sin(frame * 0.3)) : 0;
        return (
          <group key={d.id} position={[d.x, 0, d.z]}>
            <Platform color={color} pulse={pulse} />
            {d.id === "faa" ? <FAA color={color} down={down} frame={frame} tHit={since(beats, frame, "faaHit")} /> : null}
            {d.id === "microsoft" ? <Microsoft color={color} down={down} /> : null}
            {d.id === "banks" ? <Banks color={color} down={down} tZelle={since(beats, frame, "zelle")} t={t} /> : null}
            {d.id === "united" ? <United color={color} down={down} frame={frame} /> : null}
            {d.id === "nsa" ? <NSA color={color} frame={frame} /> : null}
            {d.id === "apple" ? <Apple color={color} /> : null}
            {d.id === "sony" ? <Sony color={color} down={down} frame={frame} /> : null}
            <Scaffold h={TOP[d.id] + 0.25} amount={st.scaffold} />
            <Beacon id={d.id} y={TOP[d.id]} st={st} frame={frame} />
          </group>
        );
      })}
      <Motes frame={frame} />
      <WarmUp />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.6} luminanceSmoothing={0.25} intensity={0.95} />
        <Vignette eskil={false} offset={0.3} darkness={0.6} />
      </EffectComposer>
    </>
  );
};

// ---------------------------------------------------------------- HUD overlay
const Chip: React.FC<{ x: number; y: number; text: string; color?: string; s?: number; size?: number }> = ({ x, y, text, color = K.white, s = 1, size = 24 }) => {
  if (s <= 0.01) return null;
  const w = text.length * size * 0.62 + 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * s})`} opacity={clamp01(s)}>
      <rect x={-w / 2} y={-size} width={w} height={size * 2} rx={8} fill={K.panel} stroke={color} strokeWidth={2} />
      <text x={0} y={size * 0.34} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={size} fill={color} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

/**
 * Header: an outage counter ("OUTAGE 03 / 07") that ticks up as each event lands, the current
 * date and event, and a 7-stop date timeline underneath (one node per outage, in order).
 */
const Header: React.FC<{ states: DState[]; count: number; bump: number; date: string; event: string; tone: string; current: number; frame: number }> = ({
  states,
  count,
  bump,
  date,
  event,
  tone,
  current,
  frame,
}) => {
  const x0 = 150;
  const x1 = 930;
  const step = (x1 - x0) / (DISTRICTS.length - 1);
  const filled = Math.max(0, count - 1);
  return (
    <g>
      {/* counter */}
      <rect x={110} y={250} width={330} height={96} rx={18} fill={K.panel} stroke={count > 0 ? tone : "rgba(255,255,255,0.3)"} strokeWidth={2.5} />
      <text x={146} y={300} fontFamily={BODY} fontWeight={900} fontSize={20} fill={K.muted} letterSpacing={2} transform="rotate(-90 146 300)" textAnchor="middle">
        OUTAGE
      </text>
      <g transform={`translate(230 ${322}) scale(${1 + bump * 0.25})`}>
        <text x={0} y={0} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={72} fill={count > 0 ? tone : K.white} filter="url(#kglow)">
          {String(count).padStart(2, "0")}
        </text>
      </g>
      <text x={300} y={320} fontFamily={MONO} fontWeight={700} fontSize={36} fill={K.muted}>
        / 07
      </text>
      {/* date + event */}
      <rect x={458} y={250} width={512} height={96} rx={18} fill={K.panel} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
      <circle cx={490} cy={281} r={8} fill={tone} filter="url(#kglow)" opacity={0.6 + 0.4 * Math.abs(Math.sin(frame * 0.15))} />
      <text x={510} y={290} fontFamily={MONO} fontWeight={700} fontSize={30} fill={tone}>
        {date}
      </text>
      <text x={486} y={330} fontFamily={BODY} fontWeight={900} fontSize={24} fill={K.white} letterSpacing={1}>
        {event}
      </text>
      {/* timeline */}
      <line x1={x0} y1={392} x2={x1} y2={392} stroke="#2A3850" strokeWidth={4} strokeLinecap="round" />
      {filled > 0 ? <line x1={x0} y1={392} x2={x0 + filled * step} y2={392} stroke={tone} strokeWidth={4} strokeLinecap="round" filter="url(#kglow)" /> : null}
      {DISTRICTS.map((d, k) => {
        const st = states[k];
        const hit = st.state !== "ok";
        const isCur = k === current;
        const c = hit ? colorOf(st.state) : "#3A4864";
        return (
          <g key={d.id} transform={`translate(${x0 + k * step} 392)`}>
            {isCur ? <circle r={20 + 4 * Math.sin(frame * 0.25)} fill="none" stroke={c} strokeWidth={2} opacity={0.7} /> : null}
            <circle r={isCur ? 12 : 9} fill={hit ? c : K.bg} stroke={c} strokeWidth={3} filter={hit ? "url(#kglow)" : undefined} />
            <text y={36} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={18} fill={hit ? K.white : K.muted}>
              {d.date.replace("NOV ", "")}
            </text>
          </g>
        );
      })}
      <text x={x0 - 22} y={428} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={16} fill={K.muted}>
        NOV
      </text>
    </g>
  );
};

/** Header date / event text per beat ("" = use the district's own). */
const HEAD: Record<string, [string, string, string]> = {
  hook: ["NOV 12-18", "ONE WEEK", K.red],
  question: ["NOV 12-18", "CAUSE: UNKNOWN", K.red],
  imagine: ["SAME WEEK", "UPGRADES EVERYWHERE", K.amber],
  here: ["NOV 12", "THE TIMELINE", K.cyan],
  twist: ["NOV 12-18", "CAUSE: UPGRADES", K.amber],
  callback: ["NOV 12-18", "NO ATTACK FOUND", K.green],
  end: ["WHAT'S NEXT?", "WILL IT CONTINUE?", K.red],
};

const Overlay: React.FC<{ beats: Beats; frame: number; mode: Mode }> = ({ beats, frame, mode }) => {
  const states = DISTRICTS.map((_, i) => stateOf(i, beats, frame));
  const s = (name: string, delay = 0, len = 0.3) => smooth(ramp(since(beats, frame, name), delay, delay + len));
  const out = (name: string) => 1 - smooth(ramp(since(beats, frame, name), -0.2, 0.05));
  const during = (name: string, next: string, delay = 0) => s(name, delay) * out(next);
  let cur = ORDER[0];
  ORDER.forEach((b) => {
    if (beats[b] !== undefined && frame >= beats[b]) cur = b;
  });
  const di = mode.set ? DISTRICTS.findIndex((d) => d.id === mode.set) : -1;
  const [date, event, tone] = di >= 0 ? [DISTRICTS[di].date, DISTRICTS[di].name, K.red] : HEAD[cur];
  const count = states.filter((st) => st.state !== "ok").length;
  // Counter bump: the newest outage's age (story beats and the hook cascade).
  const ages = states.filter((st) => st.state === "down").map((st) => st.age);
  const bump = ages.length ? clamp01(1 - Math.min(...ages) / 0.35) : 0;
  const t = frame / FPS;
  const hookCard = 1 - smooth(ramp(t, 1.05, 1.3));
  const flash = mode.cut ? clamp01(1 - (frame - mode.cutAt) / FPS / 0.22) : 0;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <KitDefs />
      <Header states={states} count={count} bump={bump} date={date} event={event} tone={tone} current={di} frame={frame} />

      {/* hook + question */}
      <TitleCard y={560} line1="7 OUTAGES" line2="1 WEEK" sub="YOUR FLIGHT · YOUR BANK · EVEN THE NSA" s={hookCard} accent={K.red} />
      <BigStat x={540} y={600} value="HACKED?" color={K.red} size={150} s={during("question", "imagine")} />

      {/* imagine */}
      <Chip x={540} y={500} text="EVERY BUILDING · SAME WEEK" color={K.amber} s={during("imagine", "here", 0.4)} />

      {mode.set ? <EventPopups id={mode.set} t={mode.t} f={mode.f} g={mode.g} frame={frame} montage={mode.montage} /> : null}

      {/* twist */}
      <g opacity={during("twist", "callback")}>
        <Checklist x={160} y={490} w={760} items={[{ text: "HACKERS", ok: false }, { text: "UPGRADES", ok: true }]} reveal={0.5 * s("notHackers", -0.2) + 0.5 * s("upgrades")} />
      </g>
      <Chip x={540} y={1190} text="DNI: MAINTENANCE & TECHNICAL CHANGES" color={K.white} size={20} s={during("twist", "callback", 2.2)} />

      {/* callback */}
      <Chip x={540} y={510} text="NO CYBERATTACK FOUND" color={K.green} size={30} s={during("callback", "end", 0.6)} />
      <Chip x={540} y={590} text="SERVICES RESTORED" color={K.green} s={during("callback", "end", 1.4)} />

      {/* ending */}
      <TitleCard y={580} line1="WILL IT" line2="CONTINUE?" accent={K.red} s={s("end", 0.1)} />
      <g opacity={s("end", 1.4)}>
        <rect x={330} y={1060} width={420} height={90} rx={22} fill={K.red} filter="url(#kglow)" />
        <text x={540} y={1118} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={40} fill={K.white}>FOLLOW FOR MORE</text>
        <text x={540} y={1190} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={26} fill={K.cyan}>@frontierin60</text>
      </g>

      <Disclaimer text="ILLUSTRATION · SIMPLIFIED · AI VOICE · SOURCES IN CAPTION" />
      {/* hard-cut flash */}
      {flash > 0 ? <rect x={0} y={0} width={W} height={H} fill="#DFF6FF" opacity={0.42 * flash} /> : null}
    </svg>
  );
};

// ---------------------------------------------------------------- stage
export const OutageCity: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const beats = useContext(BeatsContext);
  const mode = modeAt(beats, frame, durationInFrames);
  const base = shotAt(beats, frame, durationInFrames);
  // Small punch-in on every hard cut.
  const punch = mode.cut ? clamp01(1 - (frame - mode.cutAt) / FPS / 0.3) : 0;
  const shot = { ...base, zoom: base.zoom * (1 + 0.07 * punch) };
  const pose = camPose(shot);
  return (
    <AbsoluteFill style={{ background: P.bg }}>
      <ThreeCanvas
        width={W}
        height={H}
        orthographic
        shadows="soft"
        camera={{ position: pose.pos.toArray() as [number, number, number], zoom: pose.zoom, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        onCreated={logRenderer}
      >
        <World beats={beats} frame={frame} shot={shot} mode={mode} />
      </ThreeCanvas>
      {beats.still === undefined ? <Overlay beats={beats} frame={frame} mode={mode} /> : null}
    </AbsoluteFill>
  );
};
