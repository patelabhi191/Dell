import React, { useContext } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Line, MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BeatsContext } from "../beats";
import { BigStat, Callout, K, KitDefs, MONO, TitleCard } from "../kit";
import { BODY } from "../theme";
import { WarmUp, logRenderer } from "../three/common";

/**
 * Episode 008 "Why RAM costs 4x": one 3D set per beat in the R4/R5 look (macro product shots,
 * soft key light with rim lights, grey-blue world, depth of field) and the R4/R5 interface
 * (chapter tabs showing finished + current only, pinned labels, live panels, source cards,
 * boxed captions). Creator-style edit: punch-in and colour split on every cut, camera shake on
 * impacts, (no film grain: it speckled bright colours).
 *
 * Facts are the checked versions (DDR5 chip spot price; OpenAI letters of intent with the 40%
 * as an analyst estimate; Nvidia's $30B stake; Bain's $2T / $800B). Brands appear as names in
 * their colours; no logo artwork is drawn.
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
  nvidia: "#76B900",
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

// ---------------------------------------------------------------- textures (drawn once)
const makeTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const DOLLAR_TEX = makeTex(128, 128, (g) => {
  g.fillStyle = "#2F5E2A";
  g.font = "bold 104px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("$", 64, 70);
});
/** Silicon wafer: rainbow sheen, grid of dies, flat notch. */
const WAFER_TEX = makeTex(512, 512, (g) => {
  const grd = g.createRadialGradient(220, 200, 20, 256, 256, 256);
  grd.addColorStop(0, "#E6E9F5");
  grd.addColorStop(0.35, "#A99BF2");
  grd.addColorStop(0.6, "#6FD0E0");
  grd.addColorStop(0.82, "#E8C887");
  grd.addColorStop(1, "#8E9BB8");
  g.save();
  g.beginPath();
  g.arc(256, 256, 252, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(20,24,40,0.55)";
  g.lineWidth = 2;
  for (let x = 12; x < 512; x += 26) {
    for (let y = 12; y < 512; y += 26) {
      const dx = x + 11 - 256;
      const dy = y + 11 - 256;
      if (dx * dx + dy * dy < 228 * 228) g.strokeRect(x, y, 22, 22);
    }
  }
  g.restore();
  g.fillStyle = "#1C2430";
  g.fillRect(170, 496, 172, 16);
});
const DDR5_TEX = makeTex(512, 160, (g) => {
  g.fillStyle = "#121418";
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = "#2A2E36";
  g.lineWidth = 6;
  for (let x = -160; x < 512; x += 36) {
    g.beginPath();
    g.moveTo(x, 160);
    g.lineTo(x + 160, 0);
    g.stroke();
  }
  g.fillStyle = "#F4F6FA";
  g.font = "900 92px Arial, sans-serif";
  g.textBaseline = "middle";
  g.fillText("DDR5", 30, 84);
  g.fillStyle = "#9AA4B8";
  g.font = "700 30px Arial, sans-serif";
  g.fillText("MEMORY", 330, 84);
});
const NVIDIA_TEX = makeTex(512, 128, (g) => {
  g.fillStyle = "#0C0E10";
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#76B900";
  g.font = "italic 900 84px Arial, sans-serif";
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.fillText("NVIDIA", 256, 68);
});

// ---------------------------------------------------------------- camera
type Pose = { p: THREE.Vector3; t: THREE.Vector3 };
const SHOTS: Record<Beat, [Pose, Pose]> = {
  price: [
    { p: v3(0.2, 1.8, 7.4), t: v3(0, 1.3, 0.3) },
    { p: v3(0.8, 2.1, 8.4), t: v3(0, 1.2, 0.6) },
  ],
  reason: [
    { p: v3(2.6, 2.8, 6.8), t: v3(0, 0.45, -0.5) },
    { p: v3(1.6, 2.4, 7.4), t: v3(0, 0.45, -0.5) },
  ],
  deal: [
    { p: v3(1.2, 6.0, 9.6), t: v3(0, 0.6, -1.0) },
    { p: v3(-1.0, 5.2, 9.2), t: v3(0, 0.6, -1.0) },
  ],
  loop: [
    { p: v3(0.4, 3.1, 8.8), t: v3(0.35, 1.2, -0.5) },
    { p: v3(-0.7, 2.9, 8.4), t: v3(0.35, 1.2, -0.5) },
  ],
  flower: [
    { p: v3(-1.0, 3.2, 9.4), t: v3(0.2, 0.9, -1.0) },
    { p: v3(1.4, 3.4, 9.8), t: v3(0.2, 0.9, -1.0) },
  ],
  math: [
    { p: v3(4.6, 3.6, 11.5), t: v3(0, 1.6, 0) },
    { p: v3(2.8, 3.2, 10.8), t: v3(0, 1.7, 0) },
  ],
  bubble: [
    { p: v3(1.2, 2.0, 7.8), t: v3(0, 1.2, 0) },
    { p: v3(-0.8, 1.8, 7.2), t: v3(0, 1.2, 0) },
  ],
  end: [
    { p: v3(1.4, 2.0, 7.6), t: v3(0, 1.3, 0) },
    { p: v3(0.5, 1.8, 6.6), t: v3(0, 1.3, 0) },
  ],
};

/** Moments that shake the camera: sacks landing, the 800B gap, the bubble pop. */
const impacts = (beats: Beats) =>
  [beats.sacks !== undefined ? beats.sacks + 0.65 * FPS : undefined, beats.gap !== undefined ? beats.gap - 0.4 * FPS : undefined, beats.pop].filter((x): x is number => x !== undefined);

const poseAt = (beats: Beats, frame: number, total: number): Pose => {
  const b = current(beats, frame);
  const s = beats[b] ?? 0;
  const i = ORDER.indexOf(b);
  const nx = ORDER[i + 1];
  const e = nx && beats[nx] !== undefined ? beats[nx] : total;
  const u = Easing.inOut(Easing.quad)(clamp01((frame - s) / Math.max(1, e - s)));
  const [a, z] = SHOTS[b];
  const p = a.p.clone().lerp(z.p, u);
  const t = a.t.clone().lerp(z.t, u);
  // Creator-style cut: start a little closer and settle back over 0.35 s.
  const cut = i === 0 ? 0 : 1 - smooth(ramp((frame - s) / FPS, 0, 0.35));
  p.lerp(t, 0.1 * cut);
  // Camera shake on impacts.
  for (const at of impacts(beats)) {
    const k = (frame - at) / FPS;
    if (k >= 0 && k < 0.45) {
      const amp = 0.06 * (1 - k / 0.45);
      p.x += Math.sin(frame * 2.7) * amp;
      p.y += Math.cos(frame * 3.3) * amp;
    }
  }
  return { p, t };
};

// ---------------------------------------------------------------- shared 3D bits
const glow = (color: string, intensity: number, opacity = 1) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
);
const Box: React.FC<{ p: V; s: V; c?: string; rot?: V; metal?: number; rough?: number; children?: React.ReactNode }> = ({ p, s, c = P.slate, rot = [0, 0, 0], metal = 0.15, rough = 0.65, children }) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow>
    <boxGeometry args={s} />
    {children ?? <meshStandardMaterial color={c} metalness={metal} roughness={rough} />}
  </mesh>
);

/** Plain memory stick: green board, black chips, gold contacts. Board centre at (0, 0.9, 0). */
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
    {Array.from({ length: 34 }, (_, k) => (
      <Box key={`g${k}`} p={[-1.4 + k * 0.085 + (k > 16 ? 0.05 : 0), 0.53, 0.024]} s={[0.05, 0.1, 0.004]} c={P.gold} metal={0.95} rough={0.25} />
    ))}
    <Box p={[1.2, 1.2, 0.03]} s={[0.4, 0.16, 0.01]} c={P.light} />
  </group>
);

/**
 * Premium DDR5 stick: black anodised heat spreader with "DDR5" print and a top RGB light bar
 * that cycles colour (the look PC builders and hardware channels use in product shots).
 * Same footprint as Dimm: centre at (0, 0.9, 0), 3.0 wide.
 */
const DDR5Stick: React.FC<{ phase: number; heat?: number; p?: V; rotY?: number; s?: number }> = ({ phase, heat = 0, p = [0, 0, 0], rotY = 0, s = 1 }) => (
  <group position={p} rotation={[0, rotY, 0]} scale={s}>
    <Box p={[0, 0.88, 0]} s={[3.0, 0.78, 0.03]} c="#18201C" />
    {[-1, 1].map((side) => (
      <group key={side} position={[0, 0.92, side * 0.045]}>
        <Box p={[0, 0, 0]} s={[3.08, 0.82, 0.03]} c="#16181D" metal={0.75} rough={0.32} />
        {/* angular cut on the spreader */}
        <Box p={[0.9, 0.3, side * 0.018]} s={[1.0, 0.05, 0.012]} rot={[0, 0, -0.35]} c="#2B2F37" metal={0.8} rough={0.3} />
        {DDR5_TEX && side === 1 ? (
          <mesh position={[-0.55, -0.02, 0.017]}>
            <planeGeometry args={[1.5, 0.47]} />
            <meshStandardMaterial map={DDR5_TEX} metalness={0.4} roughness={0.45} />
          </mesh>
        ) : null}
      </group>
    ))}
    {/* RGB light bar */}
    <Box p={[0, 1.38, 0]} s={[3.08, 0.12, 0.13]} c="#0E1014" metal={0.5} rough={0.4} />
    {Array.from({ length: 16 }, (_, k) => {
      const c = new THREE.Color().setHSL((phase * 0.25 + k / 16) % 1, 0.9, 0.58);
      return (
        <mesh key={k} position={[-1.43 + k * 0.19, 1.43, 0]}>
          <boxGeometry args={[0.18, 0.05, 0.1]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      );
    })}
    {Array.from({ length: 34 }, (_, k) => (
      <Box key={`g${k}`} p={[-1.4 + k * 0.085 + (k > 16 ? 0.05 : 0), 0.53, 0.02]} s={[0.05, 0.1, 0.004]} c={P.gold} metal={0.95} rough={0.25} />
    ))}
    {heat > 0.01 ? (
      <mesh position={[0, 0.92, 0.065]}>
        <planeGeometry args={[3.0, 0.8]} />
        <meshStandardMaterial color={P.amber} emissive={P.amber} emissiveIntensity={0.6 * heat} transparent opacity={0.12 * heat} toneMapped={false} />
      </mesh>
    ) : null}
  </group>
);

/** Stand a stick upright (long side vertical), centred on (x, y, z). */
const Upright: React.FC<{ p: V; rotY: number; s?: number; children: React.ReactNode }> = ({ p, rotY, s = 1, children }) => (
  <group position={p} rotation={[0, rotY, 0]} scale={s}>
    <group rotation={[0, 0, Math.PI / 2]}>
      <group position={[0, -0.9, 0]}>{children}</group>
    </group>
  </group>
);

/** Round display plinth with a glowing rim. */
const Plinth: React.FC<{ p: V; r?: number; color: string; k?: number }> = ({ p, r = 0.75, color, k = 1.6 }) => (
  <group position={p}>
    <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[r, r * 1.08, 0.24, 48]} />
      <meshStandardMaterial color="#2A3242" metalness={0.5} roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.245, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - 0.05, r, 64]} />
      {glow(color, k)}
    </mesh>
  </group>
);

/** Wireframe memory stick: memory that hasn't been made yet. */
const GHOST_BOARD = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.0, 0.82, 0.045));
const GHOST_CHIP = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.27, 0.36, 0.04));
const GhostDimm: React.FC<{ p: V; rotY?: number; a: number; color?: string }> = ({ p, rotY = 0, a, color = "#8FD8FF" }) =>
  a <= 0.01 ? null : (
    <group position={p} rotation={[0, rotY, 0]}>
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

// ---------------------------------------------------------------- 1. price: RAM vs DDR5, money sacks
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
/** x, z, size, delay */
const SACKS: [number, number, number, number][] = [
  [-1.35, 1.2, 0.8, 0],
  [1.4, 1.35, 0.85, 0.08],
  [-0.55, 1.9, 0.7, 0.16],
  [0.6, 2.05, 0.75, 0.22],
  [-1.6, 2.3, 0.65, 0.3],
  [1.65, 2.5, 0.7, 0.36],
  [0.0, 2.8, 0.8, 0.12],
  [-2.1, 0.6, 0.75, 0.26],
];
const PriceSet: React.FC<{ t: number; sacks: number }> = ({ t, sacks }) => {
  const heat = smooth(ramp(t, 2.3, 4.5));
  const g = 34;
  return (
    <group>
      {/* rim lights behind each stick */}
      <pointLight position={[-1.1, 2.2, -1.2]} color={P.cyan} intensity={9} distance={5} />
      <pointLight position={[1.1, 2.2, -1.2]} color="#B57BFF" intensity={9} distance={5} />
      <Plinth p={[-0.66, 0, 0]} r={0.6} color={P.cyan} />
      <Plinth p={[0.66, 0, 0]} r={0.6} color="#B57BFF" />
      <Upright p={[-0.66, 1.48 + Math.sin(t * 1.6) * 0.04, 0]} rotY={0.35 + Math.sin(t * 0.7) * 0.18} s={0.76}>
        <Dimm heat={heat} />
      </Upright>
      <Upright p={[0.66, 1.48 + Math.sin(t * 1.6 + 1.5) * 0.04, 0]} rotY={-0.35 + Math.sin(t * 0.7 + 1) * 0.18} s={0.76}>
        <DDR5Stick phase={t} heat={heat * 0.4} />
      </Upright>
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

// ---------------------------------------------------------------- 2. reason: memory that hasn't been made
const FIELD = Array.from({ length: 9 }, (_, k) => ({ x: -1.5 + (k % 3) * 1.5, z: -2.0 + Math.floor(k / 3) * 1.3, r: 0.12 * Math.sin(k * 1.7) }));
const ReasonSet: React.FC<{ appear: number; vanish: number }> = ({ appear, vanish }) => (
  <group>
    {FIELD.map(({ x, z, r }, k) => {
      const up = smooth(ramp(appear, k * 0.05, k * 0.05 + 0.45));
      const v = vanish - (k % 3) * 0.08 - Math.floor(k / 3) * 0.06;
      const solid = up * (1 - smooth(ramp(v, 0, 0.25)));
      const ghost = smooth(ramp(v, 0, 0.2)) * (1 - smooth(ramp(v, 0.5, 1.0)));
      return (
        <group key={k}>
          {solid > 0.01 ? (
            <group position={[x, -0.49 * 0.55, z]} rotation={[0, r, 0]} scale={[0.55, 0.55 * solid, 0.55]}>
              {k % 2 ? <DDR5Stick phase={k} /> : <Dimm heat={0.3} />}
            </group>
          ) : null}
          <group position={[x, -0.49 * 0.55, z]} rotation={[0, r, 0]} scale={0.55}>
            <GhostDimm p={[0, 0, 0]} a={ghost} />
          </group>
          {v > 0.1 && v < 0.9
            ? Array.from({ length: 6 }, (_, j) => (
                <mesh key={j} position={[x + (random(`fx${k}${j}`) - 0.5) * 1.4, 0.3 + (v - 0.1) * (0.8 + random(`fy${k}${j}`) * 1.2), z + (random(`fz${k}${j}`) - 0.5) * 0.3]}>
                  <sphereGeometry args={[0.03, 6, 6]} />
                  {glow("#8FD8FF", 3, 1 - clamp01((v - 0.1) / 0.8))}
                </mesh>
              ))
            : null}
        </group>
      );
    })}
  </group>
);

// ---------------------------------------------------------------- 3. deal: wafers from Samsung + SK Hynix
const WAFER_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 64);
const WAFER_MATS = [
  new THREE.MeshStandardMaterial({ color: "#B8C0D0", metalness: 0.9, roughness: 0.25 }),
  new THREE.MeshStandardMaterial({ map: WAFER_TEX ?? undefined, metalness: 0.75, roughness: 0.22, emissive: "#3A3060", emissiveIntensity: 0.15 }),
  new THREE.MeshStandardMaterial({ color: "#9AA4B8", metalness: 0.9, roughness: 0.3 }),
];
const Wafer: React.FC<{ p: V; s?: number; spin?: number }> = ({ p, s = 1, spin = 0 }) => (
  <mesh geometry={WAFER_GEO} material={WAFER_MATS} position={p} rotation={[0, spin, 0]} scale={s} castShadow />
);
const FAB_A = v3(-2.6, 0, -3.4); // Samsung
const FAB_B = v3(2.6, 0, -3.4); // SK Hynix
const GATE = v3(0, 0, 0.6); // OpenAI Stargate
const Fab: React.FC<{ p: THREE.Vector3; accent: string; frame: number }> = ({ p, accent, frame }) => (
  <group position={p.toArray() as V}>
    <Box p={[0, 0.55, 0]} s={[2.2, 1.1, 1.5]} c="#C9D0DA" rough={0.55} />
    <Box p={[0, 1.13, 0]} s={[2.3, 0.08, 1.6]} c="#8E98A8" />
    {[-0.7, 0, 0.7].map((x) => (
      <Box key={x} p={[x, 1.28, -0.2]} s={[0.4, 0.22, 0.5]} c="#A9B2C0" />
    ))}
    {[0.75, -0.75].map((x, k) => (
      <group key={x}>
        <mesh position={[x, 1.6, 0.45]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 1.0, 16]} />
          <meshStandardMaterial color="#9AA4B4" metalness={0.5} roughness={0.4} />
        </mesh>
        {Array.from({ length: 4 }, (_, j) => {
          const u = ((frame / FPS) * 0.5 + j / 4 + k * 0.3) % 1;
          return (
            <mesh key={j} position={[x + u * 0.2, 2.15 + u * 1.0, 0.45]}>
              <sphereGeometry args={[0.1 + u * 0.18, 12, 12]} />
              <meshStandardMaterial color="#E8ECF2" transparent opacity={0.35 * (1 - u)} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    ))}
    <mesh position={[0, 0.55, 0.755]}>
      <planeGeometry args={[1.9, 0.18]} />
      {glow(accent, 1.4)}
    </mesh>
  </group>
);
const LANE_A = new THREE.QuadraticBezierCurve3(FAB_A.clone().add(v3(0.6, 0.1, 0.9)), v3(-1.4, 0.1, -0.6), GATE.clone().add(v3(-0.9, 0.1, -0.4)));
const LANE_B = new THREE.QuadraticBezierCurve3(FAB_B.clone().add(v3(-0.6, 0.1, 0.9)), v3(1.4, 0.1, -0.6), GATE.clone().add(v3(0.9, 0.1, -0.4)));
const DealSet: React.FC<{ t: number; frame: number; share: number }> = ({ t, frame, share }) => {
  const shrink = 1 - 0.55 * smooth(ramp(share, 0, 0.5));
  const ring = 0.4 * smooth(ramp(share, 0.6, 2.2));
  return (
    <group>
      <Fab p={FAB_A} accent="#5B8CFF" frame={frame} />
      <Fab p={FAB_B} accent="#FF6A5B" frame={frame} />
      {/* Stargate data centre */}
      <group position={GATE.toArray() as V}>
        <Box p={[0, 0.8, 0]} s={[2.0, 1.6, 1.6]} c={P.slate2} />
        <Box p={[0, 1.65, 0]} s={[2.1, 0.1, 1.7]} c={P.light} />
        {[-0.55, 0, 0.55].map((x) => (
          <mesh key={x} position={[x, 0.9, 0.805]}>
            <boxGeometry args={[0.32, 1.0, 0.01]} />
            {glow(P.cyan, 0.9 + 0.3 * Math.sin(frame * 0.1 + x * 4))}
          </mesh>
        ))}
      </group>
      {[LANE_A, LANE_B].map((lane, li) => (
        <group key={li}>
          <Line points={lane.getPoints(30)} color="#3A4658" lineWidth={14} />
          {Array.from({ length: 6 }, (_, k) => {
            const u = (t * 0.32 + k / 6 + li * 0.08) % 1;
            const p = lane.getPoint(u);
            return <Wafer key={k} p={[p.x, 0.18, p.z]} s={1.35 * shrink} spin={t + k} />;
          })}
        </group>
      ))}
      {/* world DRAM supply ring, filling to 40% after the wafers shrink */}
      <group position={[GATE.x, 0, GATE.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.0, 2.25, 128]} />
          <meshStandardMaterial color="#3A4558" roughness={0.8} />
        </mesh>
        {ring > 0.005 ? (
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.03, 0]}>
            <ringGeometry args={[1.97, 2.28, 128, 1, 0, Math.PI * 2 * ring]} />
            {glow(P.amber, 2.2)}
          </mesh>
        ) : null}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- 4. loop: Nvidia graphics card <-> OpenAI
const Fan: React.FC<{ p: V; spin: number }> = ({ p, spin }) => (
  <group position={p}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.38, 0.035, 10, 48]} />
      <meshStandardMaterial color="#2B2F37" metalness={0.7} roughness={0.3} />
    </mesh>
    <group rotation={[0, 0, spin]}>
      {Array.from({ length: 11 }, (_, k) => {
        const a = (k / 11) * Math.PI * 2;
        return (
          <mesh key={k} rotation={[0.35, 0, a]} position={[Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0]}>
            <boxGeometry args={[0.3, 0.13, 0.008]} />
            <meshStandardMaterial color="#2E333C" metalness={0.4} roughness={0.45} />
          </mesh>
        );
      })}
    </group>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.09, 0.09, 0.03, 24]} />
      <meshStandardMaterial color="#3A3F48" metalness={0.6} roughness={0.3} />
    </mesh>
  </group>
);
/** A proper graphics card standing on its edge, fans to camera. Centre at origin, 3.0 long. */
const GraphicsCard: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <Box p={[0, 0, 0]} s={[3.0, 1.1, 0.42]} c="#24272E" metal={0.7} rough={0.35} />
    {/* shroud facets */}
    <Box p={[0, 0.46, 0.215]} s={[2.9, 0.1, 0.02]} c="#3A3F48" metal={0.8} rough={0.25} />
    <Box p={[0, -0.46, 0.215]} s={[2.9, 0.1, 0.02]} c="#3A3F48" metal={0.8} rough={0.25} />
    {[-1.0, 0, 1.0].map((x, k) => (
      <Fan key={x} p={[x, 0, 0.23]} spin={t * 9 + k} />
    ))}
    {/* green light strip and side name */}
    <mesh position={[0, 0.555, 0]}>
      <boxGeometry args={[2.8, 0.02, 0.3]} />
      {glow(P.nvidia, 2.2)}
    </mesh>
    {NVIDIA_TEX ? (
      <mesh position={[0.6, 0.556, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 0.35]} />
        <meshStandardMaterial map={NVIDIA_TEX} emissive={P.nvidia} emissiveIntensity={0.15} />
      </mesh>
    ) : null}
    {NVIDIA_TEX ? (
      <mesh position={[0.95, -0.47, 0.226]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshStandardMaterial map={NVIDIA_TEX} emissive={P.nvidia} emissiveIntensity={0.25} />
      </mesh>
    ) : null}
    {/* backplate, bracket and PCIe contacts */}
    <Box p={[0, 0, -0.23]} s={[3.0, 1.1, 0.03]} c="#16181C" metal={0.6} rough={0.4} />
    <Box p={[-1.53, 0.05, 0]} s={[0.05, 1.25, 0.5]} c="#C8CDD6" metal={0.9} rough={0.2} />
    <Box p={[-0.2, -0.6, -0.1]} s={[1.6, 0.1, 0.02]} c={P.gold} metal={0.95} rough={0.25} />
  </group>
);
const GPU_POS = v3(0, 1.45, 0.3);
const AI_POS = v3(1.9, 0, -2.2);
const TOP_ARC = new THREE.QuadraticBezierCurve3(v3(1.0, 2.1, 0.2), v3(1.9, 3.0, -0.9), v3(1.9, 1.5, -1.9));
const BOTTOM_ARC = new THREE.QuadraticBezierCurve3(v3(1.5, 0.4, -1.6), v3(1.3, 0.2, 0.2), v3(0.6, 0.7, 0.6));
const LoopSet: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <pointLight position={[0, 2.6, -1.0]} color={P.nvidia} intensity={12} distance={5} />
    <Plinth p={[0, 0, 0.3]} r={1.1} color={P.nvidia} k={2} />
    <group position={GPU_POS.toArray() as V} rotation={[0.18, 0.45 + Math.sin(t * 0.6) * 0.1, 0]} scale={0.78}>
      <GraphicsCard t={t} />
    </group>
    <group position={AI_POS.toArray() as V} scale={0.75}>
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
    {[TOP_ARC, BOTTOM_ARC].map((c, k) => (
      <group key={k}>
        <Line points={c.getPoints(40)} color={P.green} lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} transparent opacity={0.85} />
        {Array.from({ length: 6 }, (_, j) => {
          const u = (t * 0.45 + j / 6) % 1;
          return (
            <mesh key={j} position={c.getPoint(u)} rotation={[0.3, u * 3, 0.2]} castShadow>
              <boxGeometry args={[0.3, 0.015, 0.15]} />
              <meshStandardMaterial color="#6CCB92" emissive="#1E6B3E" emissiveIntensity={0.6} roughness={0.6} />
            </mesh>
          );
        })}
      </group>
    ))}
  </group>
);

// ---------------------------------------------------------------- 5. flower shop on a street
const FLOWER_COLORS = ["#E86A8A", "#F2C14E", "#D9536A", "#B57BE0", "#F59B5A"];
const SHOP = v3(-1.5, 0, 0.3);
const YOU = v3(1.8, 0, 0.9);
const PAY_ARC = new THREE.QuadraticBezierCurve3(v3(1.6, 1.3, 0.9), v3(0.2, 2.5, 0.8), v3(-1.1, 1.2, 0.4));
const GIVE_ARC = new THREE.QuadraticBezierCurve3(v3(-1.0, 1.0, 0.7), v3(0.3, 0.5, 2.0), v3(1.6, 0.9, 1.2));
const Bouquet: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <group scale={s}>
    <mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.1, 0.28, 12]} />
      <meshStandardMaterial color="#F2EBDD" roughness={0.8} />
    </mesh>
    {[0, 1, 2, 3, 4].map((j) => (
      <mesh key={j} position={[Math.cos(j * 1.26) * 0.07, 0.06 + (j % 2) * 0.03, Math.sin(j * 1.26) * 0.07]}>
        <sphereGeometry args={[0.065, 10, 10]} />
        <meshStandardMaterial color={FLOWER_COLORS[j]} emissive={FLOWER_COLORS[j]} emissiveIntensity={0.2} />
      </mesh>
    ))}
  </group>
);
const FlowerSet: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {/* street behind: road with lane marks, pavement, another shop and a lamp */}
    <Box p={[0, 0.01, -2.4]} s={[16, 0.02, 2.2]} c="#20262F" rough={0.9} />
    {Array.from({ length: 9 }, (_, k) => (
      <mesh key={k} position={[-7 + k * 1.8, 0.025, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.08]} />
        {glow("#E8ECF2", 0.8)}
      </mesh>
    ))}
    <Box p={[0, 0.05, -4.0]} s={[16, 0.1, 1.0]} c="#3A4352" />
    <group position={[1.6, 0, -5.0]}>
      <Box p={[0, 1.0, 0]} s={[3.0, 2.0, 1.2]} c="#5E6A80" />
      <Box p={[0, 1.6, 0.62]} s={[2.6, 0.5, 0.04]}>
        {glow("#FFD58A", 0.7)}
      </Box>
      {Array.from({ length: 6 }, (_, k) => (
        <Box key={k} p={[-1.25 + k * 0.5, 1.25, 0.85]} s={[0.5, 0.05, 0.5]} rot={[0.4, 0, 0]} c={k % 2 ? "#F2F2F2" : "#2E9FD0"} />
      ))}
      <Box p={[0, 0.55, 0.62]} s={[1.0, 0.9, 0.03]} c="#1C2430" />
    </group>
    <group position={[-3.2, 0, -3.6]}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 2.4, 10]} />
        <meshStandardMaterial color="#2A2F38" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.25, 2.38, 0]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        {glow("#FFE3A8", 3)}
      </mesh>
      <pointLight position={[0.25, 2.3, 0.2]} color="#FFD58A" intensity={4} distance={4} />
    </group>
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
    {/* the customer */}
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
    {/* money goes to the shop ... */}
    <Line points={PAY_ARC.getPoints(30)} color={P.green} lineWidth={2} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.8} />
    {Array.from({ length: 4 }, (_, j) => (
      <mesh key={j} position={PAY_ARC.getPoint((t * 0.5 + j / 4) % 1)} rotation={[0.3, t * 3 + j, 0.2]} castShadow>
        <boxGeometry args={[0.36, 0.015, 0.18]} />
        <meshStandardMaterial color="#6CCB92" emissive="#1E6B3E" emissiveIntensity={0.6} roughness={0.6} />
      </mesh>
    ))}
    {/* ... and flowers come to the customer */}
    <Line points={GIVE_ARC.getPoints(30)} color="#E86A8A" lineWidth={2} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.8} />
    {Array.from({ length: 3 }, (_, j) => (
      <group key={j} position={GIVE_ARC.getPoint((t * 0.5 + j / 3 + 0.15) % 1).toArray() as V}>
        <Bouquet s={1.2} />
      </group>
    ))}
  </group>
);

// ---------------------------------------------------------------- 6. math: $2T needed vs revenue, $800B gap
const GAP_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 1.28, 1.0));
const MathSet: React.FC<{ t: number; gap: number }> = ({ t, gap }) => {
  const need = 3.2 * smooth(ramp(t, 0.6, 1.8));
  const have = 3.2 * 0.6 * smooth(ramp(t, 1.6, 2.8));
  // The red gap arrives just before "$800 billion" is said.
  const g = smooth(ramp(gap, -0.75, -0.4));
  const pulse = g > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(gap * 6)) : 0;
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[4.2, 0.12, 2.0]} />
      {need > 0.01 ? (
        <Box p={[-1.0, 0.12 + need / 2, 0]} s={[1.0, need, 1.0]}>
          <meshStandardMaterial color="#C98A2E" emissive={P.amber} emissiveIntensity={0.25} roughness={0.5} />
        </Box>
      ) : null}
      {have > 0.01 ? (
        <Box p={[1.0, 0.12 + have / 2, 0]} s={[1.0, have, 1.0]}>
          <meshStandardMaterial color="#2C8FB8" emissive={P.cyan} emissiveIntensity={0.25} roughness={0.5} />
        </Box>
      ) : null}
      {g > 0.01 ? (
        <group position={[1.0, 0.12 + 3.2 * 0.6 + 0.64, 0]} scale={[1, g, 1]}>
          <lineSegments geometry={GAP_EDGES}>
            <lineBasicMaterial color={P.red} transparent opacity={g} toneMapped={false} />
          </lineSegments>
          <mesh>
            <boxGeometry args={[1.0, 1.28, 1.0]} />
            <meshStandardMaterial color={P.red} emissive={P.red} emissiveIntensity={0.4 + 0.5 * pulse} transparent opacity={0.2 * g} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- 7. bubble: boom or pop
const BubbleSet: React.FC<{ t: number; pop: number; frame: number }> = ({ t, pop, frame }) => {
  const popped = pop >= 0;
  const burst = clamp01(pop / 0.6);
  const wob = 1 + 0.035 * Math.sin(frame * 0.25) + 0.02 * Math.sin(frame * 0.41);
  const tagY = popped ? Math.max(0.55, 2.35 - burst * 1.8) : 2.35 + Math.sin(t * 2) * 0.05;
  const hue = (frame * 0.004) % 1;
  const sheen = new THREE.Color().setHSL(hue, 0.6, 0.72);
  const sheen2 = new THREE.Color().setHSL((hue + 0.35) % 1, 0.7, 0.65);
  // needle creeping in from the right, touching the bubble when it pops
  const needleX = popped ? 1.62 : 3.0 - 1.35 * smooth(ramp(t, 0.2, 3.6));
  // price line inside the bubble: climbs, then drops after the pop
  const pts: V[] = Array.from({ length: 14 }, (_, k) => {
    const u = k / 13;
    const grow = smooth(ramp(t, 0.3 + u * 1.6, 0.6 + u * 1.6));
    const drop = popped ? burst * u * 1.1 : 0;
    return [-0.9 + u * 1.8, 0.75 + (Math.pow(u, 1.6) * 1.1 * grow) - drop, 0.45];
  });
  return (
    <group>
      <Plinth p={[0, 0, 0]} r={1.15} color={popped ? P.green : P.amber} k={2} />
      <group position={[0, 0.25 - 0.49 * 0.55, 0]} scale={0.55}>
        <DDR5Stick phase={t} heat={popped ? 0 : 0.3} />
      </group>
      <Line points={pts} color={popped ? P.green : P.amber} lineWidth={4} />
      {/* coins orbiting inside */}
      {!popped || burst < 1
        ? Array.from({ length: 6 }, (_, k) => {
            const a = t * 1.4 + (k / 6) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.cos(a) * 1.05, 1.15 + Math.sin(a * 2) * 0.25 - (popped ? burst * 1.2 : 0), Math.sin(a) * 0.6]} rotation={[Math.PI / 2, 0, a]}>
                <cylinderGeometry args={[0.1, 0.1, 0.025, 20]} />
                <meshStandardMaterial color="#E9B949" metalness={0.85} roughness={0.3} emissive="#7A5A10" emissiveIntensity={0.4} />
              </mesh>
            );
          })
        : null}
      {!popped || burst < 1 ? (
        <group position={[0, 1.15, 0]} scale={popped ? 1 + burst * 0.5 : wob}>
          <mesh>
            <sphereGeometry args={[1.45, 48, 48]} />
            <meshStandardMaterial color={sheen} emissive={sheen2} emissiveIntensity={0.25} transparent opacity={(popped ? 1 - burst : 1) * 0.06} roughness={0.05} metalness={0.3} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.47, 48, 48]} />
            <meshStandardMaterial color="#9FD8FF" emissive={sheen} emissiveIntensity={0.9} transparent opacity={(popped ? 1 - burst : 1) * 0.09} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* highlight */}
          <mesh position={[-0.6, 0.7, 1.12]} scale={[1, 0.55, 0.3]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.2} transparent opacity={(popped ? 1 - burst : 1) * 0.5} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      {/* needle */}
      <group position={[needleX, 1.45, 0.2]} rotation={[0, 0, Math.PI / 2 + 0.25]}>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.012, 0.004, 0.9, 10]} />
          <meshStandardMaterial color="#D9DFE8" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={P.red} roughness={0.4} />
        </mesh>
      </group>
      {/* pop: shockwave and droplets */}
      {popped && pop < 0.8 ? (
        <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1 + pop * 3}>
          <torusGeometry args={[1.45, 0.03, 8, 64]} />
          {glow("#CFEAFF", 3, 1 - pop / 0.8)}
        </mesh>
      ) : null}
      {popped && pop < 1.4
        ? Array.from({ length: 60 }, (_, k) => {
            const a = random(`ba${k}`) * Math.PI * 2;
            const e = (random(`be${k}`) - 0.5) * Math.PI;
            const r = 1.45 + burst * (1.4 + random(`br${k}`));
            return (
              <mesh key={k} position={[Math.cos(a) * Math.cos(e) * r, 1.15 + Math.sin(e) * r - pop * pop * 0.9, Math.sin(a) * Math.cos(e) * r]}>
                <sphereGeometry args={[0.03, 6, 6]} />
                {glow("#BFE8FF", 3, 1 - clamp01(pop / 1.4))}
              </mesh>
            );
          })
        : null}
      {/* price tag */}
      <group position={[1.15, tagY, 0.4]} rotation={[0, -0.3, popped ? 0.4 * burst : 0.12]}>
        <mesh>
          <planeGeometry args={[0.7, 0.36]} />
          {glow(popped ? P.green : P.amber, 1.4)}
        </mesh>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- 8. end: your RAM is the real thing
const END_GHOSTS: [number, number, number, number][] = [
  [-2.6, 1.2, -1.6, 0.4],
  [2.7, 0.9, -2.2, -0.5],
  [-0.6, 2.1, -3.4, 0.15],
  [1.8, 2.4, -1.4, -0.25],
  [-3.2, 2.2, -3.0, 0.6],
];
const EndSet: React.FC<{ t: number; real: number }> = ({ t, real }) => {
  const fade = 1 - smooth(ramp(real, 0, 0.8));
  const lit = smooth(ramp(real, 0.1, 0.7));
  const sweep = ramp(real, 0.2, 1.1);
  return (
    <group>
      {END_GHOSTS.map(([x, y, z, r], k) => (
        <GhostDimm key={k} p={[x, y - 0.5, z]} rotY={r} a={fade} />
      ))}
      <pointLight position={[0, 2.6, -1.2]} color={lit > 0 ? P.green : P.cyan} intensity={8 + 6 * lit} distance={5} />
      <Plinth p={[0, 0, 0]} r={0.9} color={lit > 0 ? P.green : P.cyan} k={1.6 + lit * 2.4} />
      <Upright p={[0, 1.42 + Math.sin(t * 1.4) * 0.05, 0]} rotY={Math.sin(t * 0.7) * 0.35} s={0.72}>
        <DDR5Stick phase={t} />
        {/* light sweep across the stick */}
        {sweep > 0 && sweep < 1 ? (
          <mesh position={[-1.6 + sweep * 3.2, 0.92, 0.09]}>
            <planeGeometry args={[0.25, 1.0]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={2} transparent opacity={0.55 * Math.sin(sweep * Math.PI)} toneMapped={false} depthWrite={false} />
          </mesh>
        ) : null}
      </Upright>
      {lit > 0
        ? Array.from({ length: 24 }, (_, k) => {
            const a = (k / 24) * Math.PI * 2 + t * 0.6;
            const y = 0.4 + ((t * 0.5 + random(`sy${k}`)) % 1) * 2.6;
            return (
              <mesh key={k} position={[Math.cos(a) * 1.0, y, Math.sin(a) * 1.0]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                {glow(P.green, 3, lit * 0.8)}
              </mesh>
            );
          })
        : null}
    </group>
  );
};

// ---------------------------------------------------------------- world
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
  // colour split spikes on every cut, then settles to a hint
  const cutAge = b === "price" ? 9 : t;
  const ca = 0.0006 + 0.005 * (1 - smooth(ramp(cutAge, 0, 0.3)));
  return (
    <>
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 9, 26]} />
      <CameraRig pose={pose} />
      {/* R5-style: one soft key light, cool sky fill; neon only as accents and rim lights. */}
      <ambientLight color="#9AA8C2" intensity={0.5} />
      <hemisphereLight args={["#C8D6F0", "#1A2230", 0.85]} />
      <directionalLight
        position={[-5, 9, 6]}
        intensity={2.5}
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
        <MeshReflectorMaterial blur={[300, 80]} resolution={1024} mixBlur={1} mixStrength={6} roughness={0.7} depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color={P.floor} metalness={0.4} mirror={0.35} />
      </mesh>
      <gridHelper args={[40, 40, "#36404F", "#303A48"]} position={[0, 0.003, 0]} />
      {b === "price" ? <PriceSet t={t} sacks={since(beats, frame, "sacks")} /> : null}
      {b === "reason" ? <ReasonSet appear={t} vanish={since(beats, frame, "vanish")} /> : null}
      {b === "deal" ? <DealSet t={t} frame={frame} share={beats.share !== undefined ? since(beats, frame, "share") : t - 2} /> : null}
      {b === "loop" ? <LoopSet t={t} /> : null}
      {b === "flower" ? <FlowerSet t={t} /> : null}
      {b === "math" ? <MathSet t={t} gap={since(beats, frame, "gap")} /> : null}
      {b === "bubble" ? <BubbleSet t={t} pop={since(beats, frame, "pop")} frame={frame} /> : null}
      {b === "end" ? <EndSet t={t} real={beats.real !== undefined ? since(beats, frame, "real") : t - 1} /> : null}
      <WarmUp />
      <EffectComposer multisampling={4}>
        <DepthOfField target={pose.t.toArray() as V} focalLength={0.03} bokehScale={3} />
        <Bloom mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.2} intensity={0.85} />
        <ChromaticAberration offset={new THREE.Vector2(ca, ca * 0.6)} radialModulation={false} modulationOffset={0} />
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

const Chip: React.FC<{ y: number; text: string; color?: string; s: number; x?: number }> = ({ y, text, color = K.white, s, x = 540 }) => {
  if (s <= 0.01) return null;
  const w = text.length * 15 + 44;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * s})`} opacity={s}>
      <rect x={-w / 2} y={-25} width={w} height={50} rx={10} fill={K.panel} stroke={color} strokeWidth={2} />
      <text x={0} y={8} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={color} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

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

/** Brand name badge in the brand's colour (no logo artwork). */
const BrandBadge: React.FC<{ x: number; y: number; name: string; color: string; ink?: string; sub?: string; s: number }> = ({ x, y, name, color, ink = "#0C0E10", sub, s }) => {
  if (s <= 0.01) return null;
  const w = name.length * 40 + 80;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.8 + 0.2 * s})`} opacity={clamp01(s * 1.5)}>
      <rect x={-w / 2} y={-48} width={w} height={96} rx={18} fill={color} filter="url(#kglow)" />
      <text x={0} y={20} textAnchor="middle" fontFamily={BODY} fontStyle="italic" fontWeight={900} fontSize={60} fill={ink} letterSpacing={2}>
        {name}
      </text>
      {sub ? (
        <text x={0} y={84} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={22} fill={K.white} letterSpacing={2}>
          {sub}
        </text>
      ) : null}
    </g>
  );
};

/** Chapter tabs (owner's rule): current highlighted, finished plain, upcoming hidden. */
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

/** DDR5 chip spot price, Sep to Dec 2025, counting up to ~4x. */
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

const Overlay: React.FC<{ beats: Beats; frame: number; pose: Pose }> = ({ beats, frame, pose }) => {
  const proj = projector(pose);
  const b = current(beats, frame);
  const t = since(beats, frame, b);
  const sAt = (d: number, len = 0.3) => smooth(ramp(t, d, d + len));
  const T = frame / FPS;
  const flash = b !== "price" ? clamp01(1 - t / 0.18) : 0;
  const vanishT = since(beats, frame, "vanish");
  const shareT = beats.share !== undefined ? since(beats, frame, "share") : t - 2;
  const bankT = since(beats, frame, "bank");
  const gapT = since(beats, frame, "gap");
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
          <TitleCard y={470} line1="WHY IS RAM" line2="4X THE PRICE?" accent={K.amber} s={1 - smooth(ramp(T, 2.0, 2.4))} />
          {pin(v3(-0.66, 0.9, 0.1), "RAM", "cyan", sAt(0.5) * (1 - smooth(ramp(t, 2.1, 2.3))), -150, 200)}
          {pin(v3(0.66, 0.9, 0.1), "DDR5 RAM", "plain", sAt(0.8) * (1 - smooth(ramp(t, 2.1, 2.3))), 150, 200)}
          <PricePanel t={t - 2.2} s={sAt(2.3, 0.4)} top={400} />
          <Source y={740} text="SOURCE: TOM'S HARDWARE RAM PRICE INDEX · 2025" s={sAt(3.2)} />
        </>
      ) : null}

      {b === "reason" ? (
        <>
          <Tag y={520} text="AI COMPANIES ARE BUYING IT" color={K.cyan} s={sAt(0.3) * (1 - smooth(ramp(vanishT, -0.1, 0.1)))} />
          <Tag y={520} text="MEMORY THAT HASN'T BEEN MADE YET" color="#8FD8FF" s={smooth(ramp(vanishT, 0.05, 0.35))} />
        </>
      ) : null}

      {b === "deal" ? (
        <>
          {pin(v3(FAB_A.x, 1.4, FAB_A.z), "SAMSUNG", "cyan", sAt(0.3), -40, -170)}
          {pin(v3(FAB_B.x, 1.4, FAB_B.z), "SK HYNIX", "red", sAt(0.6), 40, -170)}
          {pin(v3(GATE.x + 0.6, 1.3, GATE.z + 0.8), "OPENAI · STARGATE", "plain", sAt(1.0), 150, 170)}
          <Chip y={1150} text="UP TO 900,000 WAFERS / MONTH" color={K.white} s={sAt(1.6) * (1 - smooth(ramp(shareT, -0.2, 0.1)))} />
          <BigStat x={540} y={1120} value={`${Math.round(40 * smooth(ramp(shareT, 0, 0.6)))}%`} label="OF WORLD SUPPLY · ANALYST ESTIMATE" color={K.amber} size={150} s={smooth(ramp(shareT, 0, 0.3))} />
          <Source y={1268} text="LETTERS OF INTENT · OCT 1, 2025" s={sAt(2.2)} />
        </>
      ) : null}

      {b === "loop" ? (
        <>
          <BrandBadge x={540} y={500} name="NVIDIA" color={P.nvidia} sub="THE AI CHIP GIANT" s={sAt(0.15)} />
          {pin(v3(AI_POS.x, 1.3, AI_POS.z), "OPENAI", "plain", sAt(0.6), 60, -200)}
          {(() => {
            const a = proj(TOP_ARC.getPoint(0.45));
            const c = proj(BOTTOM_ARC.getPoint(0.5));
            return (
              <>
                <Chip x={Math.min(820, a.x + 60)} y={a.y - 50} text="$30B STAKE" color={K.green} s={sAt(1.4)} />
                <Chip x={Math.min(820, c.x + 40)} y={Math.min(1180, c.y + 60)} text="GPU ORDERS" color={K.green} s={sAt(1.9)} />
              </>
            );
          })()}
          <Source y={1268} text="FEB 2026 · A $100B PLAN BECAME A $30B STAKE" s={sAt(2.4)} />
        </>
      ) : null}

      {b === "flower" ? (
        <>
          {pin(v3(SHOP.x, 1.95, SHOP.z), "MY FLOWER SHOP", "plain", sAt(0.2), -40, -230)}
          {pin(v3(YOU.x, 1.5, YOU.z), "YOU", "plain", sAt(0.4), 20, -260)}
          <Chip y={1110} text="$1,000 → SHOP · FLOWERS → YOU" color={K.green} s={sAt(0.9)} />
          {(() => {
            const sb = smooth(ramp(bankT, 0.1, 0.4));
            if (sb <= 0.01) return null;
            return (
              <g transform={`translate(540 620) scale(${0.85 + 0.15 * sb})`} opacity={sb}>
                <rect x={-300} y={-95} width={600} height={190} rx={18} fill="#F5F7FB" />
                <rect x={-300} y={-95} width={600} height={46} rx={18} fill="#1F3A5F" />
                <rect x={-300} y={-70} width={600} height={21} fill="#1F3A5F" />
                <text x={0} y={-62} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={22} fill="#fff" letterSpacing={2}>
                  BANK · SHOP VALUATION
                </text>
                <text x={0} y={40} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={64} fill="#1C7A4A">
                  $1,000,000,000
                </text>
                <g transform={`translate(250 -70) rotate(10) scale(${smooth(ramp(bankT, 0.6, 0.8))})`}>
                  <circle r={42} fill={K.red} />
                  <text y={22} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={60} fill="#fff">
                    ?
                  </text>
                </g>
              </g>
            );
          })()}
          <Tag y={1190} text="CIRCULAR MONEY, MADE-UP VALUE" color={K.amber} s={smooth(ramp(bankT, 0.9, 1.2))} />
        </>
      ) : null}

      {b === "math" ? (
        <>
          {pin(v3(-1.0, 3.35, 0), "$2T NEEDED A YEAR BY 2030", "amber", sAt(1.2), -60, -150)}
          {pin(v3(1.0, 2.05, 0.5), "REVENUE ON TRACK", "cyan", sAt(2.4), 60, 260)}
          {pin(v3(1.0, 3.0, 0.5), "$800B SHORT", "red", smooth(ramp(gapT, -0.1, 0.2)), 70, -200)}
          {(() => {
            const a = proj(v3(1.0, 2.7, 0.5));
            return [
              [-150, -40, -12],
              [140, -110, 10],
              [-110, -190, -6],
              [170, 10, 14],
            ].map(([dx, dy, r], k) => {
              const s = smooth(ramp(gapT, 1.3 + k * 0.12, 1.55 + k * 0.12));
              if (s <= 0.01) return null;
              const bob = Math.sin(T * 6 + k) * 8;
              return (
                <text key={k} x={a.x + dx} y={a.y + dy + bob} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={96 * s} fill={K.red} stroke="#000" strokeWidth={6} paintOrder="stroke" transform={`rotate(${r} ${a.x + dx} ${a.y + dy})`}>
                  ?
                </text>
              );
            });
          })()}
          <Source y={1272} text="BAIN & COMPANY · GLOBAL TECHNOLOGY REPORT · SEP 2025" s={sAt(1.6)} />
        </>
      ) : null}

      {b === "bubble" ? (
        <>
          <Tag y={520} text="BOOM → RAM STAYS EXPENSIVE" color={K.amber} s={sAt(0.3) * (1 - smooth(ramp(popT, -0.6, -0.3)))} />
          <Tag y={520} text="BUBBLE → PRICES COULD CRASH" color={K.green} s={smooth(ramp(popT, 0, 0.3))} />
          {popT > 0.1 ? (
            <g transform={`translate(${proj(v3(1.15, 1.2, 0.4)).x + 90} ${proj(v3(1.15, 1.2, 0.4)).y})`} opacity={smooth(ramp(popT, 0.1, 0.4))}>
              <path d="M0 -40 L0 30 M-26 6 L0 34 L26 6" stroke={K.green} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#kglow)" />
            </g>
          ) : null}
        </>
      ) : null}

      {b === "end" ? (
        <>
          <TitleCard y={470} line1="ONLY ONE THING" line2="IS REAL" accent={K.green} s={smooth(ramp(realT, 0, 0.3)) * (1 - smooth(ramp(t, 4.0, 4.3)))} />
          {pin(v3(0, 1.3, 0.15), "YOUR RAM", "green", smooth(ramp(realT, 0.8, 1.1)), 230, -40)}
          {(() => {
            const sf = smooth(ramp(t, 4.15, 4.45));
            if (sf <= 0.01) return null;
            return (
              <g transform={`translate(540 480) scale(${0.8 + 0.2 * sf})`} opacity={sf}>
                <rect x={-250} y={-58} width={500} height={116} rx={30} fill={K.red} filter="url(#kglow)" />
                <text x={0} y={17} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={48} fill="#fff">
                  + FOLLOW FOR MORE
                </text>
                <text x={0} y={104} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={28} fill={K.cyan}>
                  @frontierin60
                </text>
              </g>
            );
          })()}
        </>
      ) : null}

      {flash > 0 ? <rect x={0} y={0} width={W} height={H} fill="#E8F2FF" opacity={0.45 * flash} /> : null}
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
