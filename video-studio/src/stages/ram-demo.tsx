import React, { useContext } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Line, MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BeatsContext } from "../beats";
import { BigStat, Callout, K, KitDefs, MONO, TitleCard } from "../kit";
import { BODY } from "../theme";
import { WarmUp, logRenderer } from "../three/common";

/**
 * Episode 008 demo (UI check): why RAM costs 4x, in three shots modelled on R5 (macro 3D
 * objects, soft key light, grey-blue matte world, depth of field) with R4/R5 interface: chapter
 * tabs, pinned labels, a live price panel, source cards, boxed captions.
 * Facts are the checked versions (chip spot price; OpenAI letters of intent with the 40% as an
 * analyst estimate; Nvidia's $30B stake that replaced the $100B letter of intent).
 */

const W = 1080;
const H = 1920;
const FPS = 30;
const FOV = 42;
const P = {
  bg: "#1C2430",
  floor: "#28323F",
  slate: "#3A4558",
  slate2: "#4A566B",
  light: "#D9DFE8",
  pcb: "#1E4A3C",
  gold: "#D9A845",
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
type V = [number, number, number];
type Beats = Record<string, number>;
const since = (beats: Beats, frame: number, name: string) => (beats[name] === undefined ? -999 : (frame - beats[name]) / FPS);

const ORDER = ["price", "reason", "deal", "loop", "flower", "math", "bubble", "end"] as const;
/** Intro shots use a clean, light studio background (owner: "clear background"). */
const STUDIO: Record<string, boolean> = { price: true, reason: true };
type Beat = (typeof ORDER)[number];
/** Chapter tab each beat belongs to (the flower analogy and the ending sit inside a chapter). */
const CHAPTERS = ["PRICE", "DEAL", "LOOP", "MATH", "BUBBLE"];
const CHAPTER_OF: Record<Beat, number> = { price: 0, reason: 0, deal: 1, loop: 2, flower: 2, math: 3, bubble: 4, end: 4 };
const current = (beats: Beats, frame: number): Beat => {
  let c: Beat = "price";
  ORDER.forEach((b) => {
    if (beats[b] !== undefined && frame >= beats[b]) c = b;
  });
  return c;
};

// ---------------------------------------------------------------- camera
type Pose = { p: THREE.Vector3; t: THREE.Vector3 };
const SHOTS: Record<Beat, [Pose, Pose]> = {
  price: [
    { p: v3(1.0, 2.0, 7.4), t: v3(0, 0.75, 0.5) },
    { p: v3(1.8, 2.7, 8.8), t: v3(0, 0.6, 0.7) },
  ],
  reason: [
    { p: v3(2.4, 2.6, 6.4), t: v3(0, 0.45, -0.5) },
    { p: v3(1.5, 2.3, 7.2), t: v3(0, 0.45, -0.5) },
  ],
  deal: [
    { p: v3(7.0, 6.0, 8.5), t: v3(0, 0.4, 0) },
    { p: v3(4.5, 4.6, 9.5), t: v3(0, 0.5, 0) },
  ],
  loop: [
    { p: v3(1.4, 4.4, 11.5), t: v3(0, 0.8, 0) },
    { p: v3(-2.0, 4.0, 11.0), t: v3(0, 0.8, 0) },
  ],
  flower: [
    { p: v3(-1.4, 3.8, 10.5), t: v3(0.2, 0.9, -0.8) },
    { p: v3(1.6, 4.2, 11.0), t: v3(0.3, 0.9, -0.9) },
  ],
  math: [
    { p: v3(4.6, 3.6, 11.5), t: v3(0, 1.6, 0) },
    { p: v3(2.8, 3.2, 10.8), t: v3(0, 1.7, 0) },
  ],
  bubble: [
    { p: v3(0.8, 1.9, 6.6), t: v3(0, 1.0, 0) },
    { p: v3(-0.8, 1.7, 6.0), t: v3(0, 1.0, 0) },
  ],
  end: [
    { p: v3(2.6, 2.4, 6.4), t: v3(0, 0.75, 0) },
    { p: v3(1.2, 1.6, 4.6), t: v3(0, 0.8, 0) },
  ],
};
const poseAt = (beats: Beats, frame: number, total: number): Pose => {
  const b = current(beats, frame);
  const s = beats[b] ?? 0;
  const i = ORDER.indexOf(b);
  const nx = ORDER[i + 1];
  const e = nx && beats[nx] !== undefined ? beats[nx] : total;
  const u = Easing.inOut(Easing.quad)(clamp01((frame - s) / Math.max(1, e - s)));
  const [a, z] = SHOTS[b];
  return { p: a.p.clone().lerp(z.p, u), t: a.t.clone().lerp(z.t, u) };
};

// ---------------------------------------------------------------- 3D bits
const glow = (color: string, intensity: number, opacity = 1) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
);
const Box: React.FC<{ p: V; s: V; c?: string; rot?: V; metal?: number; rough?: number; children?: React.ReactNode }> = ({ p, s, c = P.slate, rot = [0, 0, 0], metal = 0.15, rough = 0.65, children }) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow>
    <boxGeometry args={s} />
    {children ?? <meshStandardMaterial color={c} metalness={metal} roughness={rough} />}
  </mesh>
);

/** A DDR5 memory stick standing on its edge. `heat` 0..1 warms the chips (price rising). */
const Dimm: React.FC<{ heat: number; p?: V; rotY?: number; s?: number }> = ({ heat, p = [0, 0, 0], rotY = 0, s = 1 }) => (
  <group position={p} rotation={[0, rotY, 0]} scale={s}>
    <Box p={[0, 0.9, 0]} s={[3.0, 0.82, 0.045]} c={P.pcb} rough={0.55} />
    {Array.from({ length: 8 }, (_, k) => (
      <group key={k} position={[-1.22 + k * 0.35, 0.98, 0.04]}>
        <Box p={[0, 0, 0]} s={[0.27, 0.36, 0.04]} c="#14171D" metal={0.3} rough={0.4} />
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[0.16, 0.05]} />
          {glow(heat > 0.05 ? P.amber : "#6A7488", 0.4 + heat * 2.6)}
        </mesh>
      </group>
    ))}
    {/* gold contacts */}
    {Array.from({ length: 34 }, (_, k) => (
      <Box key={`g${k}`} p={[-1.4 + k * 0.085 + (k > 16 ? 0.05 : 0), 0.53, 0.024]} s={[0.05, 0.1, 0.004]} c={P.gold} metal={0.95} rough={0.25} />
    ))}
    <Box p={[1.2, 1.2, 0.03]} s={[0.4, 0.16, 0.01]} c={P.light} />
  </group>
);

/** Wireframe memory stick: "memory that doesn't exist yet". */
const GHOST_BOARD = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.0, 0.82, 0.045));
const GHOST_CHIP = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.27, 0.36, 0.04));
const GhostDimm: React.FC<{ p: V; rotY?: number; a: number; color?: string }> = ({ p, rotY = 0, a, color = "#8FD8FF" }) =>
  a <= 0.01 ? null : (
    <group position={p} rotation={[0, rotY, 0]} scale={[1, 0.6 + 0.4 * a, 1]}>
      <lineSegments geometry={GHOST_BOARD} position={[0, 0.9, 0]}>
        <lineBasicMaterial color={color} transparent opacity={0.85 * a} toneMapped={false} />
      </lineSegments>
      {Array.from({ length: 8 }, (_, k) => (
        <lineSegments key={k} geometry={GHOST_CHIP} position={[-1.22 + k * 0.35, 0.98, 0.04]}>
          <lineBasicMaterial color={color} transparent opacity={0.6 * a} toneMapped={false} />
        </lineSegments>
      ))}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[3.0, 0.82, 0.045]} />
        <meshStandardMaterial color="#5FB8FF" emissive="#5FB8FF" emissiveIntensity={0.4} transparent opacity={0.08 * a} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
const GHOSTS: [number, number, number, number][] = [
  [-2.6, 1.2, -1.6, 0.4],
  [2.7, 0.9, -2.2, -0.5],
  [-0.6, 1.9, -3.4, 0.15],
  [1.4, 2.4, -1.4, -0.25],
  [-3.2, 2.2, -3.0, 0.6],
];

/** "$" decal for the money sacks (drawn once, no font download needed at render time). */
const DOLLAR_TEX = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = "#2F5E2A";
  g.font = "bold 104px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("$", 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

/** A tied money sack with a "$" on the front. Sits on the floor at y = 0. */
const MoneySack: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <group scale={s}>
    <mesh position={[0, 0.36, 0]} scale={[1, 0.95, 0.92]} castShadow receiveShadow>
      <sphereGeometry args={[0.38, 28, 22]} />
      <meshStandardMaterial color="#C9A66B" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.74, 0]} castShadow>
      <cylinderGeometry args={[0.07, 0.16, 0.14, 16]} />
      <meshStandardMaterial color="#B8945A" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.085, 0.025, 8, 20]} />
      <meshStandardMaterial color="#7A5A30" roughness={0.8} />
    </mesh>
    <mesh position={[0, 0.88, 0]} castShadow>
      <coneGeometry args={[0.13, 0.14, 12]} />
      <meshStandardMaterial color="#B8945A" roughness={0.9} />
    </mesh>
    {DOLLAR_TEX ? (
      <mesh position={[0, 0.38, 0.352]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshStandardMaterial map={DOLLAR_TEX} transparent roughness={0.9} />
      </mesh>
    ) : null}
  </group>
);

/** Where the sacks land around the stick (x, z, size, start delay). */
const SACKS: [number, number, number, number][] = [
  [-1.25, 1.2, 0.9, 0],
  [1.3, 1.45, 0.95, 0.08],
  [-0.45, 1.9, 0.8, 0.16],
  [0.55, 2.2, 0.85, 0.22],
  [-1.5, 2.3, 0.75, 0.3],
  [1.55, 2.6, 0.8, 0.36],
  [-0.05, 2.9, 0.9, 0.12],
  [2.0, 0.7, 0.85, 0.26],
];

/** Intro: a clean shot of a RAM stick (DDR5); money sacks drop from the top on "four times". */
const PriceSet: React.FC<{ t: number; sacks: number }> = ({ t, sacks }) => {
  const heat = smooth(ramp(t, 2.3, 4.5));
  const g = 34;
  return (
    <group>
      <group rotation={[0, -0.35, 0]}>
        <Box p={[0, 0.2, 0]} s={[3.6, 0.4, 1.1]} c="#E8ECF2" rough={0.5} />
        <mesh position={[0, 0.405, 0.55]}>
          <boxGeometry args={[3.4, 0.01, 0.02]} />
          {glow(P.cyan, 1.6)}
        </mesh>
      </group>
      <group position={[0, 0.4 - 0.49, 0]} rotation={[0, -0.35, 0]}>
        <Dimm heat={heat} />
      </group>
      {sacks >= 0
        ? SACKS.map(([x, z, s, d], k) => {
            const tt = sacks - d;
            if (tt < 0) return null;
            const h0 = 6;
            const fall = Math.sqrt((2 * h0) / g);
            const y = tt < fall ? h0 - 0.5 * g * tt * tt : 0.35 * Math.abs(Math.sin((tt - fall) * 8)) * Math.exp(-(tt - fall) * 6);
            const spin = (random(`sk${k}`) - 0.5) * 0.8;
            return (
              <group key={k} position={[x, y, z]} rotation={[0, spin, tt < fall ? spin * 0.4 : 0]}>
                <MoneySack s={s} />
              </group>
            );
          })
        : null}
    </group>
  );
};

/** "Buying memory that hasn't even been made yet": sticks rise, then dissolve to outlines and vanish. */
const FIELD = Array.from({ length: 9 }, (_, k) => ({ x: -1.5 + (k % 3) * 1.5, z: -2.0 + Math.floor(k / 3) * 1.3, r: 0.12 * Math.sin(k * 1.7) }));
const ReasonSet: React.FC<{ appear: number; vanish: number }> = ({ appear, vanish }) => (
  <group>
    {FIELD.map(({ x, z, r }, k) => {
      const up = smooth(ramp(appear, k * 0.05, k * 0.05 + 0.45));
      const v = vanish - (k % 3) * 0.08 - Math.floor(k / 3) * 0.06;
      const solid = up * (1 - smooth(ramp(v, 0, 0.25)));
      const ghost = smooth(ramp(v, 0, 0.2)) * (1 - smooth(ramp(v, 0.45, 0.95)));
      return (
        <group key={k}>
          {solid > 0.01 ? (
            <group position={[x, -0.49 * 0.55, z]} rotation={[0, r, 0]} scale={[0.55, 0.55 * solid, 0.55]}>
              <Dimm heat={0.3} />
            </group>
          ) : null}
          <group position={[x, -0.49 * 0.55, z]} rotation={[0, r, 0]} scale={0.55}>
            <GhostDimm p={[0, 0, 0]} a={ghost} color="#1F6FC4" />
          </group>
          {v > 0.1 && v < 0.9
            ? Array.from({ length: 6 }, (_, j) => (
                <mesh key={j} position={[x + (random(`fx${k}${j}`) - 0.5) * 1.4, 0.3 + (v - 0.1) * (0.8 + random(`fy${k}${j}`) * 1.2), z + (random(`fz${k}${j}`) - 0.5) * 0.3]}>
                  <sphereGeometry args={[0.03, 6, 6]} />
                  {glow("#2F8FE0", 2.5, 1 - clamp01((v - 0.1) / 0.8))}
                </mesh>
              ))
            : null}
        </group>
      );
    })}
  </group>
);

const WAFER = new THREE.CylinderGeometry(0.42, 0.42, 0.025, 48);
const Wafer: React.FC<{ p: V; hue: number }> = ({ p, hue }) => (
  <mesh geometry={WAFER} position={p} castShadow>
    <meshStandardMaterial color={new THREE.Color().setHSL(0.6 + hue * 0.15, 0.25, 0.72)} metalness={0.9} roughness={0.18} />
  </mesh>
);
/** `s`: seconds on the share clock (the ring fills from 0.6 s to 2.4 s); defaults to `t`. */
const DealSet: React.FC<{ t: number; frame: number; s?: number }> = ({ t, frame, s }) => {
  const share = 0.4 * smooth(ramp(s ?? t, 0.6, 2.4));
  return (
    <group>
      {/* the "AI factory" the wafers flow into */}
      <Box p={[0, 0.8, 0]} s={[2.2, 1.6, 1.8]} c={P.slate2} />
      <Box p={[0, 1.65, 0]} s={[2.3, 0.1, 1.9]} c={P.light} />
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.9, 0.905]}>
          <boxGeometry args={[0.35, 1.0, 0.01]} />
          {glow(P.cyan, 0.9 + 0.3 * Math.sin(frame * 0.1 + x * 4))}
        </mesh>
      ))}
      {/* conveyor lanes of wafers from the world supply into the building */}
      {[-1.6, 0, 1.6].map((z, lane) => (
        <group key={lane}>
          <Box p={[3.6, 0.06, z * 0.55]} s={[3.6, 0.08, 0.6]} c="#222B37" />
          {Array.from({ length: 6 }, (_, k) => {
            const u = (t * 0.35 + k / 6 + lane * 0.13) % 1;
            return <Wafer key={k} p={[5.4 - u * 3.6, 0.13, z * 0.55]} hue={random(`w${lane}${k}`)} />;
          })}
        </group>
      ))}
      {/* world DRAM supply ring: grey 100%, amber share filling to 40% */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.35, 2.6, 128]} />
        <meshStandardMaterial color="#3A4558" roughness={0.8} />
      </mesh>
      {share > 0.005 ? (
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.03, 0]}>
          <ringGeometry args={[2.32, 2.63, 128, 1, 0, Math.PI * 2 * share]} />
          {glow(P.amber, 2.2)}
        </mesh>
      ) : null}
      {/* wafer stacks on the far side (the rest of the world's supply) */}
      {Array.from({ length: 7 }, (_, k) => {
        const a = Math.PI * 0.95 + (k / 6) * Math.PI * 0.85;
        return (
          <group key={k} position={[Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4]}>
            {Array.from({ length: 6 }, (_, j) => (
              <Wafer key={j} p={[0, 0.04 + j * 0.03, 0]} hue={0.3} />
            ))}
          </group>
        );
      })}
    </group>
  );
};

const GPU_POS = v3(-1.6, 0, 0);
const AI_POS = v3(1.6, 0, 0);
const TOP_ARC = new THREE.QuadraticBezierCurve3(v3(-1.0, 1.15, 0), v3(0, 2.7, 0), v3(1.0, 1.35, 0));
const BOTTOM_ARC = new THREE.QuadraticBezierCurve3(v3(1.0, 0.65, 0.5), v3(0, -0.1, 1.6), v3(-1.0, 0.65, 0.5));
const LoopSet: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {/* GPU maker: a graphics card on a plinth */}
    <group position={GPU_POS.toArray() as V} scale={0.8}>
      <Box p={[0, 0.25, 0]} s={[1.6, 0.5, 1.2]} c={P.slate} />
      <Box p={[0, 0.75, 0]} s={[1.5, 0.3, 0.8]} c="#1A1F28" metal={0.5} rough={0.35} />
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0.91, 0]}>
          <mesh rotation={[0, t * 6, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.02, 7]} />
            <meshStandardMaterial color="#2C3442" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.33, 40]} />
            {glow(P.green, 1.5)}
          </mesh>
        </group>
      ))}
    </group>
    {/* AI company: data-centre racks */}
    <group position={AI_POS.toArray() as V} scale={0.8}>
      <Box p={[0, 0.06, 0]} s={[1.9, 0.12, 1.4]} c={P.slate} />
      {[-0.55, 0, 0.55].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box p={[0, 0.8, 0]} s={[0.45, 1.4, 0.9]} c={P.slate2} />
          {Array.from({ length: 5 }, (_, k) => (
            <mesh key={k} position={[0, 0.3 + k * 0.24, 0.451]}>
              <boxGeometry args={[0.32, 0.03, 0.01]} />
              {glow(P.cyan, 2)}
            </mesh>
          ))}
        </group>
      ))}
    </group>
    {/* the loop: investment one way, GPU orders the other */}
    {[TOP_ARC, BOTTOM_ARC].map((c, k) => (
      <group key={k}>
        <Line points={c.getPoints(40)} color={P.green} lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} transparent opacity={0.85} />
        {Array.from({ length: 7 }, (_, j) => {
          const u = (t * 0.45 + j / 7) % 1;
          const p = c.getPoint(u);
          return (
            <mesh key={j} position={p} rotation={[0.3, u * 3, 0.2]} castShadow>
              <boxGeometry args={[0.32, 0.015, 0.16]} />
              <meshStandardMaterial color="#6CCB92" emissive="#1E6B3E" emissiveIntensity={0.6} roughness={0.6} />
            </mesh>
          );
        })}
        {/* arrow head at the end of each arc */}
        <mesh position={c.getPoint(0.97)} rotation={[0, 0, k === 0 ? -Math.PI / 2 - 0.7 : Math.PI / 2 - 0.6]}>
          <coneGeometry args={[0.12, 0.28, 12]} />
          {glow(P.green, 2.5)}
        </mesh>
      </group>
    ))}
  </group>
);

// ---- flower shop analogy: I pay you, you buy my flowers, I tell the bank I'm worth a billion
const FLOWER_COLORS = ["#E86A8A", "#F2C14E", "#D9536A", "#B57BE0", "#F59B5A"];
const SHOP = v3(-1.4, 0, 0.2);
const YOU = v3(1.9, 0, 0.9);
const BANK = v3(-0.1, 0, -3.3);
const PAY_ARC = new THREE.QuadraticBezierCurve3(v3(-0.7, 1.3, 0.3), v3(0.6, 2.4, 0.6), v3(1.7, 1.4, 0.9));
const BUY_ARC = new THREE.QuadraticBezierCurve3(v3(1.6, 0.9, 1.2), v3(0.4, 0.3, 2.1), v3(-0.6, 0.9, 0.7));
const BANK_ARC = new THREE.QuadraticBezierCurve3(v3(-1.3, 1.9, -0.1), v3(-1.0, 3.2, -1.8), v3(-0.2, 1.7, -3.0));
const Bill: React.FC<{ p: THREE.Vector3; spin: number }> = ({ p, spin }) => (
  <mesh position={p} rotation={[0.3, spin, 0.2]} castShadow>
    <boxGeometry args={[0.36, 0.015, 0.18]} />
    <meshStandardMaterial color="#6CCB92" emissive="#1E6B3E" emissiveIntensity={0.6} roughness={0.6} />
  </mesh>
);
const FlowerSet: React.FC<{ t: number; bank: number }> = ({ t, bank }) => (
  <group>
    {/* my flower shop */}
    <group position={SHOP.toArray() as V}>
      <Box p={[0, 0.4, 0]} s={[1.7, 0.8, 0.9]} c="#7A5A40" rough={0.8} />
      <Box p={[0, 0.82, 0]} s={[1.8, 0.05, 1.0]} c="#E8DCC8" />
      {[-0.82, 0.82].map((x) => (
        <Box key={x} p={[x, 1.25, -0.42]} s={[0.06, 1.0, 0.06]} c="#5A4A3A" />
      ))}
      {Array.from({ length: 7 }, (_, k) => (
        <Box key={`aw${k}`} p={[-0.78 + k * 0.26, 1.78, -0.1]} s={[0.26, 0.05, 0.9]} rot={[0.35, 0, 0]} c={k % 2 ? "#F2F2F2" : "#D9536A"} />
      ))}
      {Array.from({ length: 5 }, (_, k) => (
        <group key={`pot${k}`} position={[-0.64 + k * 0.32, 0.85, 0.1]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.08, 0.2, 16]} />
            <meshStandardMaterial color="#B5643C" roughness={0.8} />
          </mesh>
          {[0, 1, 2].map((j) => (
            <mesh key={j} position={[Math.cos(j * 2.1 + k) * 0.06, 0.28 + j * 0.03, Math.sin(j * 2.1 + k) * 0.06]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={FLOWER_COLORS[(k + j) % 5]} roughness={0.6} emissive={FLOWER_COLORS[(k + j) % 5]} emissiveIntensity={0.15} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
    {/* you */}
    <group position={YOU.toArray() as V}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.6, 6, 16]} />
        <meshStandardMaterial color="#5B7DB8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshStandardMaterial color="#E9C8A8" roughness={0.6} />
      </mesh>
    </group>
    {/* the bank */}
    <group position={BANK.toArray() as V}>
      <Box p={[0, 0.06, 0]} s={[1.8, 0.12, 1.2]} />
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.6, 0.45]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.95, 12]} />
          <meshStandardMaterial color={P.light} roughness={0.5} />
        </mesh>
      ))}
      <Box p={[0, 0.6, -0.1]} s={[1.6, 0.95, 0.7]} c={P.slate2} />
      <Box p={[0, 1.13, 0]} s={[1.9, 0.12, 1.25]} c={P.light} />
      <mesh position={[0, 1.33, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 1.9, 3]} />
        <meshStandardMaterial color={P.light} roughness={0.5} />
      </mesh>
    </group>
    {/* money goes round: I pay you, you pay it back for my flowers */}
    {[PAY_ARC, BUY_ARC].map((c, k) => (
      <group key={k}>
        <Line points={c.getPoints(30)} color={P.green} lineWidth={2} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.8} />
        {Array.from({ length: 4 }, (_, j) => (
          <Bill key={j} p={c.getPoint((t * 0.5 + j / 4) % 1)} spin={t * 3 + j} />
        ))}
      </group>
    ))}
    {/* bouquet travelling to you */}
    <group position={BUY_ARC.getPoint(1 - ((t * 0.5) % 1)).toArray() as V}>
      {[0, 1, 2].map((j) => (
        <mesh key={j} position={[j * 0.08 - 0.08, 0.1, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color={FLOWER_COLORS[j]} />
        </mesh>
      ))}
    </group>
    {/* ...and the claim to the bank */}
    {bank >= 0 ? <Line points={BANK_ARC.getPoints(30).slice(0, Math.max(2, Math.round(31 * smooth(ramp(bank, 0, 0.6)))))} color={P.amber} lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} /> : null}
  </group>
);

// ---- the math: $2T needed a year vs revenue on track, $800B short (Bain, Sep 2025)
const MathSet: React.FC<{ t: number; short: number }> = ({ t, short }) => {
  const need = 3.2 * smooth(ramp(t, 0.6, 1.8));
  const have = 3.2 * 0.6 * smooth(ramp(t, 1.6, 2.8));
  const gap = smooth(ramp(short, 0, 0.4));
  const gapEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 3.2 * 0.4, 1.0));
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[4.2, 0.12, 2.0]} />
      {need > 0.01 ? (
        <Box p={[-1.0, 0.12 + need / 2, 0]} s={[1.0, need, 1.0]} c="#C98A2E" rough={0.5}>
          <meshStandardMaterial color="#C98A2E" emissive={P.amber} emissiveIntensity={0.25} roughness={0.5} />
        </Box>
      ) : null}
      {have > 0.01 ? (
        <Box p={[1.0, 0.12 + have / 2, 0]} s={[1.0, have, 1.0]}>
          <meshStandardMaterial color="#2C8FB8" emissive={P.cyan} emissiveIntensity={0.25} roughness={0.5} />
        </Box>
      ) : null}
      {gap > 0.01 ? (
        <group position={[1.0, 0.12 + 3.2 * 0.6 + 0.64, 0]}>
          <lineSegments geometry={gapEdges}>
            <lineBasicMaterial color={P.red} transparent opacity={gap} toneMapped={false} />
          </lineSegments>
          <mesh>
            <boxGeometry args={[1.0, 1.28, 1.0]} />
            <meshStandardMaterial color={P.red} emissive={P.red} emissiveIntensity={0.5} transparent opacity={0.16 * gap} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

// ---- the bubble: boom keeps RAM expensive, a pop could crash prices
const BubbleSet: React.FC<{ t: number; pop: number; frame: number }> = ({ t, pop, frame }) => {
  const popped = pop >= 0;
  const burst = clamp01(pop / 0.6);
  const wob = 1 + 0.035 * Math.sin(frame * 0.25) + 0.02 * Math.sin(frame * 0.41);
  const tagY = popped ? Math.max(0.55, 2.25 - burst * 1.7) : 2.25 + Math.sin(t * 2) * 0.05;
  return (
    <group>
      <Box p={[0, 0.22, 0]} s={[2.2, 0.44, 1.0]} />
      <group position={[0, -0.05, 0]} scale={0.6}>
        <Dimm heat={popped ? 1 - burst * 0.8 : 1} p={[0, 0.2, 0]} />
      </group>
      {!popped || burst < 1 ? (
        <group position={[0, 1.15, 0]} scale={popped ? 1 + burst * 0.5 : wob}>
          <mesh>
            <sphereGeometry args={[1.45, 48, 48]} />
            <meshStandardMaterial color="#CFEAFF" transparent opacity={(popped ? 1 - burst : 1) * 0.13} roughness={0.05} metalness={0.2} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.47, 48, 48]} />
            <meshStandardMaterial color="#9FD8FF" emissive="#9FD8FF" emissiveIntensity={0.6} transparent opacity={(popped ? 1 - burst : 1) * 0.12} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      {popped && pop < 1.4
        ? Array.from({ length: 48 }, (_, k) => {
            const a = random(`ba${k}`) * Math.PI * 2;
            const e = (random(`be${k}`) - 0.5) * Math.PI;
            const r = 1.45 + burst * 1.6;
            return (
              <mesh key={k} position={[Math.cos(a) * Math.cos(e) * r, 1.15 + Math.sin(e) * r - pop * pop * 0.8, Math.sin(a) * Math.cos(e) * r]}>
                <sphereGeometry args={[0.03, 6, 6]} />
                {glow("#BFE8FF", 3, 1 - clamp01(pop / 1.4))}
              </mesh>
            );
          })
        : null}
      {/* price tag: floats high, drops when it pops */}
      <group position={[1.15, tagY, 0.3]} rotation={[0, -0.3, popped ? 0.4 * burst : 0.12]}>
        <mesh>
          <planeGeometry args={[0.7, 0.36]} />
          {glow(popped ? P.green : P.amber, 1.4)}
        </mesh>
      </group>
    </group>
  );
};

// ---- the end: only one thing is real
const EndSet: React.FC<{ t: number; real: number; frame: number }> = ({ t, real, frame }) => {
  const fade = 1 - smooth(ramp(real, 0, 0.8));
  const lit = smooth(ramp(real, 0.2, 0.8));
  return (
    <group>
      {GHOSTS.map(([x, y, z, r], k) => (
        <GhostDimm key={`eg${k}`} p={[x, y - 0.5, z]} rotY={r} a={fade} />
      ))}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.1, 1.2, 0.5, 48]} />
        <meshStandardMaterial color={P.slate} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.08, 64]} />
        {glow(lit > 0 ? P.green : P.cyan, 1.5 + lit * 2)}
      </mesh>
      <group position={[0, 0.48 - 0.49, 0]} rotation={[0, Math.sin(t * 0.6) * 0.25, 0]} scale={0.62}>
        <Dimm heat={0.4 + lit * 0.6} />
      </group>
      {void frame}
    </group>
  );
};

const CameraRig: React.FC<{ pose: Pose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera);
  camera.position.copy(pose.p);
  camera.lookAt(pose.t);
  camera.updateMatrixWorld();
  return null;
};

const World: React.FC<{ beats: Beats; frame: number; pose: Pose }> = ({ beats, frame, pose }) => {
  const b = current(beats, frame);
  const t = since(beats, frame, b);
  const studio = STUDIO[b] === true;
  const bg = studio ? "#D9DFE7" : P.bg;
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, studio ? 10 : 9, studio ? 22 : 26]} />
      <CameraRig pose={pose} />
      {/* R5-style: one soft key light, cool sky fill, no neon as a light source. */}
      <ambientLight color={studio ? "#FFFFFF" : "#9AA8C2"} intensity={studio ? 0.75 : 0.45} />
      <hemisphereLight args={studio ? ["#FFFFFF", "#9AA4B4", 1.0] : ["#C8D6F0", "#1A2230", 0.8]} />
      <directionalLight
        position={[-5, 9, 6]}
        intensity={2.4}
        color="#F4F6FF"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[6, 4, -5]} intensity={0.6} color="#9FC4FF" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        {studio ? (
          <meshStandardMaterial color="#D3DAE3" roughness={0.85} />
        ) : (
          <MeshReflectorMaterial blur={[300, 80]} resolution={1024} mixBlur={1} mixStrength={6} roughness={0.7} depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color={P.floor} metalness={0.4} mirror={0.35} />
        )}
      </mesh>
      {studio ? null : <gridHelper args={[40, 40, "#36404F", "#303A48"]} position={[0, 0.003, 0]} />}
      {b === "price" ? <PriceSet t={t} sacks={since(beats, frame, "sacks")} /> : null}
      {b === "reason" ? <ReasonSet appear={t} vanish={since(beats, frame, "vanish")} /> : null}
      {b === "deal" ? <DealSet t={t} s={beats.share !== undefined ? since(beats, frame, "share") + 0.6 : t} frame={frame} /> : null}
      {b === "loop" ? <LoopSet t={t} /> : null}
      {b === "flower" ? <FlowerSet t={t} bank={since(beats, frame, "bank")} /> : null}
      {b === "math" ? <MathSet t={t} short={since(beats, frame, "short")} /> : null}
      {b === "bubble" ? <BubbleSet t={t} pop={since(beats, frame, "pop")} frame={frame} /> : null}
      {b === "end" ? <EndSet t={t} real={since(beats, frame, "real")} frame={frame} /> : null}
      <WarmUp />
      <EffectComposer multisampling={4}>
        <DepthOfField target={pose.t.toArray() as V} focalLength={0.03} bokehScale={3} />
        <Bloom mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.2} intensity={0.8} />
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
      </EffectComposer>
    </>
  );
};

// ---------------------------------------------------------------- UI overlay
const projector = (pose: Pose) => {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 100);
  cam.position.copy(pose.p);
  cam.lookAt(pose.t);
  cam.updateMatrixWorld();
  return (p: THREE.Vector3) => {
    const q = p.clone().project(cam);
    return { x: (q.x * 0.5 + 0.5) * W, y: (1 - (q.y * 0.5 + 0.5)) * H };
  };
};

const Source: React.FC<{ y: number; text: string; s: number }> = ({ y, text, s }) => {
  if (s <= 0.01) return null;
  const w = text.length * 12.4 + 60;
  return (
    <g transform={`translate(540 ${y}) scale(${0.9 + 0.1 * s})`} opacity={s}>
      <rect x={-w / 2} y={-22} width={w} height={44} rx={8} fill="#F4F6FA" />
      <rect x={-w / 2} y={-22} width={10} height={44} rx={4} fill={K.cyan} />
      <text x={-w / 2 + 26} y={7} fontFamily={MONO} fontWeight={700} fontSize={19} fill="#2A3140">
        {text}
      </text>
    </g>
  );
};

const Chip: React.FC<{ y: number; text: string; color?: string; s: number }> = ({ y, text, color = K.white, s }) => {
  if (s <= 0.01) return null;
  const w = text.length * 15 + 44;
  return (
    <g transform={`translate(540 ${y})`} opacity={s}>
      <rect x={-w / 2} y={-25} width={w} height={50} rx={10} fill={K.panel} stroke={color} strokeWidth={2} />
      <text x={0} y={8} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={color} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

/** R4/R5-style data panel: DDR5 chip spot price, Sep to Dec 2025, counting up to ~4x. */
const PricePanel: React.FC<{ t: number; s: number; top?: number }> = ({ t, s, top = 930 }) => {
  if (s <= 0.01) return null;
  const x0 = 150;
  const y0 = top;
  const w = 780;
  const h = 300;
  const u = smooth(ramp(t, 0.3, 2.6));
  const price = 6.84 + (27.2 - 6.84) * u;
  // Endpoints are the sourced values; the curve between them is a simplified shape.
  const pts = Array.from({ length: 41 }, (_, k) => {
    const q = k / 40;
    const v = 6.84 + (27.2 - 6.84) * Math.pow(q, 1.8);
    return [x0 + 60 + q * (w - 120), y0 + h - 60 - ((v - 4) / 26) * (h - 120)] as [number, number];
  });
  const shown = pts.slice(0, Math.max(2, Math.round(41 * u)));
  const d = shown.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = shown[shown.length - 1];
  return (
    <g opacity={s} transform={`translate(${540 * (1 - s)} 0)`}>
      <rect x={x0} y={y0} width={w} height={h} rx={18} fill={K.panel} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      <text x={x0 + 28} y={y0 + 42} fontFamily={BODY} fontWeight={900} fontSize={22} fill={K.white} letterSpacing={1}>
        DDR5 CHIP · SPOT PRICE
      </text>
      <text x={x0 + w - 28} y={y0 + 46} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={34} fill={K.amber}>
        ${price.toFixed(2)}
      </text>
      {["SEP", "OCT", "NOV", "DEC"].map((m, k) => (
        <text key={m} x={x0 + 60 + (k / 3) * (w - 120)} y={y0 + h - 22} textAnchor="middle" fontFamily={MONO} fontSize={18} fill={K.muted}>
          {m}
        </text>
      ))}
      <line x1={x0 + 50} y1={y0 + h - 55} x2={x0 + w - 50} y2={y0 + h - 55} stroke="#2A3850" strokeWidth={2} />
      <path d={d} fill="none" stroke={K.amber} strokeWidth={5} strokeLinecap="round" filter="url(#kglow)" />
      <circle cx={lx} cy={ly} r={8} fill={K.amber} filter="url(#kglow)" />
      <text x={x0 + 60} y={y0 + h - 75} fontFamily={MONO} fontSize={18} fill={K.muted}>
        $6.84
      </text>
      {u > 0.92 ? (
        <g transform={`translate(${x0 + w - 150} ${y0 + 100}) scale(${smooth(ramp(t, 2.5, 2.8))})`}>
          <rect x={-60} y={-30} width={120} height={60} rx={12} fill={K.red} />
          <text x={0} y={12} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={36} fill="#fff">
            ≈4X
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** Amber/green statement tag. */
const Tag: React.FC<{ y: number; text: string; color: string; s: number }> = ({ y, text, color, s }) => {
  if (s <= 0.01) return null;
  const w = Math.min(960, text.length * 21 + 60);
  return (
    <g transform={`translate(540 ${y}) scale(${0.85 + 0.15 * s})`} opacity={s}>
      <rect x={-w / 2} y={-34} width={w} height={68} rx={14} fill={K.panel} stroke={color} strokeWidth={3} />
      <text x={0} y={10} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={28} fill={color} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

/**
 * Chapter tabs (owner's rule): the current chapter highlighted, finished chapters plain,
 * upcoming chapters hidden. Slots keep fixed positions so tabs never jump.
 */
const ProgressTabs: React.FC<{ chapters: string[]; active: number; y?: number }> = ({ chapters, active, y = 300 }) => {
  const w = Math.min(160, 860 / chapters.length);
  const x0 = 540 - (w * chapters.length) / 2;
  return (
    <g>
      {chapters.map((c, i) =>
        i > active ? null : (
          <g key={c} transform={`translate(${x0 + i * w} ${y})`}>
            <rect x={4} y={-24} width={w - 8} height={48} rx={6} fill={i === active ? K.cyan : K.panel} stroke={i === active ? "none" : "rgba(255,255,255,0.45)"} strokeWidth={2} filter={i === active ? "url(#kglow)" : undefined} />
            <text x={w / 2} y={8} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={20} fill={i === active ? "#081020" : K.white}>
              {c}
            </text>
          </g>
        ),
      )}
    </g>
  );
};

const Overlay: React.FC<{ beats: Beats; frame: number; pose: Pose }> = ({ beats, frame, pose }) => {
  const proj = projector(pose);
  const b = current(beats, frame);
  const t = since(beats, frame, b);
  const sAt = (d: number, len = 0.3) => smooth(ramp(t, d, d + len));
  const T = frame / FPS;
  const flash = b !== "price" ? clamp01(1 - t / 0.2) : 0;
  const appearT = since(beats, frame, "appear");
  const vanishT = since(beats, frame, "vanish");
  const shareT = beats.share !== undefined ? since(beats, frame, "share") + 0.6 : t;
  const bankT = since(beats, frame, "bank");
  const shortT = since(beats, frame, "short");
  const popT = since(beats, frame, "pop");
  const realT = beats.real !== undefined ? since(beats, frame, "real") : t - 1;
  const pin = (p: THREE.Vector3, text: string, tone: "cyan" | "amber" | "green" | "red" | "plain", s: number, dx: number, dy: number) => {
    const a = proj(p);
    return <Callout x={a.x} y={a.y} tx={Math.max(250, Math.min(830, a.x + dx))} ty={Math.max(470, Math.min(1230, a.y + dy))} text={text} tone={tone} s={s} />;
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <KitDefs />
      <ProgressTabs chapters={CHAPTERS} active={CHAPTER_OF[b]} />

      {b === "price" ? (
        <>
          <TitleCard y={500} line1="WHY IS RAM" line2="4X THE PRICE?" accent={K.amber} s={1 - smooth(ramp(T, 2.0, 2.4))} />
          {pin(v3(-0.8, 1.15, 0.35), "RAM", "plain", sAt(0.5) * (1 - smooth(ramp(t, 2.1, 2.3))), -120, 260)}
          {pin(v3(1.1, 0.85, -0.3), "DDR5 MEMORY", "cyan", sAt(0.8) * (1 - smooth(ramp(t, 2.1, 2.3))), 80, 280)}
          <PricePanel t={t - 2.2} s={sAt(2.3, 0.4)} top={400} />
          <Source y={740} text="SOURCE: TOM'S HARDWARE RAM PRICE INDEX · 2025" s={sAt(3.2)} />
        </>
      ) : null}

      {b === "reason" ? (
        <>
          <Tag y={520} text="AI COMPANIES ARE BUYING IT" color={K.cyan} s={smooth(ramp(appearT, 0, 0.3)) * (1 - smooth(ramp(vanishT, -0.1, 0.1)))} />
          <Tag y={520} text="MEMORY THAT HASN'T BEEN MADE YET" color="#8FD8FF" s={smooth(ramp(vanishT, 0.05, 0.35))} />
        </>
      ) : null}

      {b === "deal" ? (
        <>
          <BigStat x={540} y={600} value={`${Math.round(40 * smooth(ramp(shareT, 0.6, 2.4)))}%`} label="OF WORLD DRAM · ANALYST ESTIMATE" color={K.amber} size={170} s={smooth(ramp(shareT, 0.3, 0.6))} />
          {pin(v3(0.9, 1.2, 0.9), "OPENAI · STARGATE", "cyan", sAt(0.5), 170, -90)}
          <Chip y={1140} text="UP TO 900,000 WAFERS / MONTH" color={K.white} s={sAt(1.0)} />
          <Source y={1210} text="LETTERS OF INTENT · OCT 1, 2025 · SAMSUNG + SK HYNIX" s={sAt(1.6)} />
        </>
      ) : null}

      {b === "loop" ? (
        <>
          {pin(v3(-1.6, 0.85, 0), "NVIDIA", "plain", sAt(0.3), -40, -260)}
          {pin(v3(1.6, 1.3, 0), "OPENAI", "plain", sAt(0.5), 40, -260)}
          {(() => {
            const a = proj(TOP_ARC.getPoint(0.5));
            const c = proj(BOTTOM_ARC.getPoint(0.5));
            return (
              <>
                <Chip y={a.y - 60} text="$30B STAKE →" color={K.green} s={sAt(0.9)} />
                <Chip y={Math.min(1175, c.y + 70)} text="← GPU ORDERS" color={K.green} s={sAt(1.4)} />
              </>
            );
          })()}
          <Source y={1268} text="FEB 2026 · A $100B PLAN BECAME A $30B STAKE" s={sAt(2.0)} />
        </>
      ) : null}

      {b === "flower" ? (
        <>
          {pin(v3(SHOP.x, 1.9, SHOP.z), "MY FLOWER SHOP", "plain", sAt(0.2), -60, -250)}
          {pin(v3(YOU.x, 1.5, YOU.z), "YOU", "plain", sAt(0.4), 30, -280)}
          <Chip y={1100} text="I PAY YOU $1,000 → YOU BUY MY FLOWERS" color={K.green} s={sAt(0.9)} />
          {(() => {
            const sb = smooth(ramp(bankT, 0.2, 0.5));
            if (sb <= 0.01) return null;
            return (
              <g transform={`translate(540 640) scale(${0.85 + 0.15 * sb})`} opacity={sb}>
                <rect x={-300} y={-95} width={600} height={190} rx={18} fill="#F5F7FB" />
                <rect x={-300} y={-95} width={600} height={46} rx={18} fill="#1F3A5F" />
                <rect x={-300} y={-70} width={600} height={21} fill="#1F3A5F" />
                <text x={0} y={-62} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={22} fill="#fff" letterSpacing={2}>
                  BANK · SHOP VALUATION
                </text>
                <text x={0} y={40} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={64} fill="#1C7A4A">
                  $1,000,000,000
                </text>
                <g transform={`translate(250 -70) rotate(10) scale(${smooth(ramp(bankT, 0.7, 0.9))})`}>
                  <circle r={42} fill={K.red} />
                  <text y={22} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={60} fill="#fff">
                    ?
                  </text>
                </g>
              </g>
            );
          })()}
          <Tag y={1180} text="CIRCULAR MONEY, MADE-UP VALUE" color={K.amber} s={smooth(ramp(bankT, 1.0, 1.3))} />
        </>
      ) : null}

      {b === "math" ? (
        <>
          {pin(v3(-1.0, 3.35, 0), "$2T NEEDED A YEAR BY 2030", "amber", sAt(1.2), -60, -150)}
          {pin(v3(1.0, 2.05, 0.5), "REVENUE ON TRACK", "cyan", sAt(2.4), 60, 260)}
          {pin(v3(1.0, 3.0, 0.5), "$800B SHORT", "red", smooth(ramp(shortT, 0.1, 0.4)), 70, -200)}
          <Source y={1272} text="BAIN & COMPANY · GLOBAL TECHNOLOGY REPORT · SEP 2025" s={sAt(1.6)} />
        </>
      ) : null}

      {b === "bubble" ? (
        <>
          <Tag y={560} text="BOOM → RAM STAYS EXPENSIVE" color={K.amber} s={sAt(0.3) * (1 - smooth(ramp(popT, -0.6, -0.3)))} />
          <Tag y={560} text="BUBBLE → PRICES COULD CRASH" color={K.green} s={smooth(ramp(popT, 0, 0.3))} />
        </>
      ) : null}

      {b === "end" ? (
        <>
          <TitleCard y={560} line1="ONLY ONE THING" line2="IS REAL" accent={K.green} s={smooth(ramp(realT, 0, 0.3)) * (1 - smooth(ramp(t, 4.3, 4.6)))} />
          {pin(v3(0, 1.1, 0.1), "YOUR RAM", "green", smooth(ramp(realT, 0.9, 1.2)), 160, 150)}
          {(() => {
            const sf = smooth(ramp(t, 4.4, 4.7));
            if (sf <= 0.01) return null;
            return (
              <g transform={`translate(540 600) scale(${0.8 + 0.2 * sf})`} opacity={sf}>
                <rect x={-240} y={-55} width={480} height={110} rx={28} fill={K.red} filter="url(#kglow)" />
                <text x={0} y={16} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={46} fill="#fff">
                  + FOLLOW FOR MORE
                </text>
                <text x={0} y={100} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={28} fill={K.cyan}>
                  @frontierin60
                </text>
              </g>
            );
          })()}
        </>
      ) : null}

      {flash > 0 ? <rect x={0} y={0} width={W} height={H} fill="#E8F2FF" opacity={0.4 * flash} /> : null}
    </svg>
  );
};

export const RamDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const beats = useContext(BeatsContext);
  const pose = poseAt(beats, frame, durationInFrames);
  return (
    <AbsoluteFill style={{ background: P.bg }}>
      <ThreeCanvas
        width={W}
        height={H}
        shadows="soft"
        camera={{ fov: FOV, near: 0.05, far: 100, position: pose.p.toArray() as V }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        onCreated={logRenderer}
      >
        <World beats={beats} frame={frame} pose={pose} />
      </ThreeCanvas>
      {beats.still === undefined ? <Overlay beats={beats} frame={frame} pose={pose} /> : null}
    </AbsoluteFill>
  );
};
