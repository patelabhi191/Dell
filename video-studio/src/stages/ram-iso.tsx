import React, { useContext } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BeatsContext } from "../beats";
import { BigStat, Callout, K, KitDefs, MONO, TitleCard } from "../kit";
import { BODY } from "../theme";
import { WarmUp, logRenderer } from "../three/common";

/**
 * Episode 008 "Why RAM costs 4x", rebuilt on the owner's direction: R4 as the main reference,
 * R3 for what R4 does not have.
 *
 * R4: true isometric (orthographic) camera, everything sharp; dark slate grid world; matte
 * blocks with glowing coloured edges and coloured light pools on the floor; rows of objects
 * changing state; boxed labels pinned beside objects; status bar with segment lights.
 * R3: chapter tabs (current filled, finished outlined, upcoming hidden); stacked server blocks
 * with cyan stripes; small flat tiles travelling along lanes.
 *
 * Screen zones (nothing overlaps the 3D scene):
 *   tabs y≈300 · headline band 360-560 · 3D band 580-1160 (camera auto-fits each scene here)
 *   · card band 1180-1300 · captions 1330-1420.
 */

const W = 1080;
const H = 1920;
const FPS = 30;
const BAND = { top: 590, bottom: 1165, left: 110, right: 970 };

const P = {
  bg: "#10161F",
  floor: "#131B26",
  grid1: "#1F2B3B",
  grid2: "#18222F",
  block: "#222C3A",
  blockTop: "#2D3A4D",
  light: "#D7DEE8",
  pcb: "#173B30",
  gold: "#D9A845",
  nvidia: "#76B900",
  cyan: K.cyan,
  red: K.red,
  amber: K.amber,
  green: K.green,
  white: K.white,
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t)).getHexString()}`;
type V = [number, number, number];
type Beats = Record<string, number>;
const since = (beats: Beats, frame: number, name: string) => (beats[name] === undefined ? -999 : (frame - beats[name]) / FPS);

const ORDER = ["price", "reason", "deal", "loop", "flower", "math", "bubble", "end"] as const;
type Beat = (typeof ORDER)[number];
const CHAPTERS = ["PRICE", "DEAL", "LOOP", "MATH", "BUBBLE"];
const CHAPTER_OF: Record<Beat, number> = { price: 0, reason: 0, deal: 1, loop: 2, flower: 2, math: 3, bubble: 4, end: 4 };
const current = (beats: Beats, frame: number): Beat => {
  let c: Beat = "price";
  ORDER.forEach((b) => {
    if (beats[b] !== undefined && frame >= beats[b]) c = b;
  });
  return c;
};

// ---------------------------------------------------------------- textures
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
const POOL_TEX = makeTex(256, 256, (g) => {
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
});
const CHIP_TEX = makeTex(256, 256, (g) => {
  const grd = g.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, "#E9ECF4");
  grd.addColorStop(0.5, "#BFC8DA");
  grd.addColorStop(1, "#9EB2D8");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(30,40,60,0.55)";
  g.lineWidth = 2;
  for (let x = 14; x < 242; x += 26) for (let y = 14; y < 242; y += 26) g.strokeRect(x, y, 20, 20);
});
const DOLLAR_TEX = makeTex(128, 128, (g) => {
  g.fillStyle = "#2F5E2A";
  g.font = "bold 104px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("$", 64, 70);
});

// ---------------------------------------------------------------- camera: isometric, auto-fit to the 3D band
const EL = Math.atan(1 / Math.SQRT2);
type Fit = { pos: THREE.Vector3; target: THREE.Vector3; zoom: number };
type Box3 = [V, V];
/** Bounding box of each scene's objects (world units). The camera fits it into BAND. */
const SCENE_BOX: Record<Beat, Box3> = {
  price: [[-2.5, 0, -0.3], [2.5, 2.8, 0.3]],
  reason: [[-2.5, 0, -0.7], [3.9, 2.8, 0.7]],
  deal: [[-2.1, 0, -2.1], [3.0, 1.9, 2.9]],
  loop: [[-2.3, 0, -1.95], [1.95, 1.8, 1.85]],
  flower: [[-2.0, 0, -2.4], [1.8, 1.6, 1.85]],
  math: [[-1.35, 0, -1.35], [1.35, 3.3, 1.35]],
  bubble: [[-1.5, 0, -1.5], [1.5, 2.85, 1.5]],
  end: [[-1.2, 0, -1.2], [1.2, 2.7, 1.2]],
};
const fitBox = (box: Box3, azDeg: number, zoomMul: number): Fit => {
  const a = (azDeg * Math.PI) / 180;
  const dir = v3(Math.sin(a) * Math.cos(EL), Math.sin(EL), Math.cos(a) * Math.cos(EL));
  const [mn, mx] = box;
  const c = v3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 200);
  cam.position.copy(c.clone().add(dir.clone().multiplyScalar(40)));
  cam.lookAt(c);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const x of [mn[0], mx[0]])
    for (const y of [mn[1], mx[1]])
      for (const z of [mn[2], mx[2]]) {
        const q = v3(x, y, z).project(cam);
        x0 = Math.min(x0, (q.x * W) / 2);
        x1 = Math.max(x1, (q.x * W) / 2);
        y0 = Math.min(y0, (q.y * H) / 2);
        y1 = Math.max(y1, (q.y * H) / 2);
      }
  const bw = BAND.right - BAND.left;
  const bh = BAND.bottom - BAND.top;
  const zoom = Math.min(bw / (x1 - x0), bh / (y1 - y0)) * zoomMul;
  // Put the box centre at the band centre (screen y measured upward from the middle).
  const want = H / 2 - (BAND.top + BAND.bottom) / 2;
  const right = v3(1, 0, 0).applyQuaternion(cam.quaternion);
  const up = v3(0, 1, 0).applyQuaternion(cam.quaternion);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const target = c.clone().add(right.multiplyScalar(cx)).add(up.multiplyScalar(cy - want / zoom));
  return { pos: target.clone().add(dir.multiplyScalar(40)), target, zoom };
};
const AZ: Record<Beat, [number, number]> = {
  price: [40, 48],
  reason: [42, 48],
  deal: [44, 50],
  loop: [46, 40],
  flower: [42, 48],
  math: [40, 50],
  bubble: [44, 38],
  end: [38, 48],
};
const shotAt = (beats: Beats, frame: number, total: number): Fit => {
  const b = current(beats, frame);
  const s = beats[b] ?? 0;
  const i = ORDER.indexOf(b);
  const nx = ORDER[i + 1];
  const e = nx && beats[nx] !== undefined ? beats[nx] : total;
  const u = Easing.inOut(Easing.quad)(clamp01((frame - s) / Math.max(1, e - s)));
  const [a0, a1] = AZ[b];
  // Slow push-in through each shot; a quick settle after each cut (R4 cuts are calm).
  const settle = i === 0 ? 0 : 1 - smooth(ramp((frame - s) / FPS, 0, 0.3));
  return fitBox(SCENE_BOX[b], a0 + (a1 - a0) * u, 1.0 + 0.05 * u + 0.05 * settle);
};

// ---------------------------------------------------------------- 3D building blocks
const glow = (color: string, intensity: number, opacity = 1) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
);
const Matte: React.FC<{ c?: string; metal?: number; rough?: number }> = ({ c = P.block, metal = 0.15, rough = 0.7 }) => (
  <meshStandardMaterial color={c} metalness={metal} roughness={rough} />
);
/** R4 block: rounded matte body, optional glowing edge band around the top. */
const Block: React.FC<{ p: V; s: V; c?: string; edge?: string; edgeK?: number; r?: number }> = ({ p, s, c = P.block, edge, edgeK = 2, r = 0.04 }) => (
  <group position={p}>
    <RoundedBox args={s} radius={r} smoothness={3} position={[0, s[1] / 2, 0]} castShadow receiveShadow>
      <Matte c={c} />
    </RoundedBox>
    {edge
      ? [
          [0, s[2] / 2, s[0], 0.03],
          [0, -s[2] / 2, s[0], 0.03],
          [s[0] / 2, 0, 0.03, s[2]],
          [-s[0] / 2, 0, 0.03, s[2]],
        ].map(([x, z, w, d], k) => (
          <mesh key={k} position={[x, s[1] - 0.04, z]}>
            <boxGeometry args={[w + 0.01, 0.04, d + 0.01]} />
            {glow(edge, edgeK)}
          </mesh>
        ))
      : null}
  </group>
);
/** Soft coloured light on the floor under an object (R4's red/amber/cyan glows). */
const Pool: React.FC<{ p: V; r: number; color: string; k?: number }> = ({ p, r, color, k = 1 }) =>
  POOL_TEX && k > 0.01 ? (
    <mesh position={[p[0], 0.006, p[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[r * 2, r * 2]} />
      <meshBasicMaterial map={POOL_TEX} color={color} transparent opacity={0.55 * k} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  ) : null;

/** RAM stick standing upright like an R4 rack: PCB, chips, gold contacts, top status light. */
const RamStick: React.FC<{ p: V; led: string; ledK?: number; s?: number }> = ({ p, led, ledK = 2.4, s = 1 }) => (
  <group position={p} scale={s}>
    <Block p={[0, 0, 0]} s={[0.95, 0.16, 0.36]} c="#1A222D" />
    <RoundedBox args={[0.78, 2.4, 0.07]} radius={0.02} smoothness={3} position={[0, 0.16 + 1.2, 0]} castShadow receiveShadow>
      <Matte c={P.pcb} rough={0.55} />
    </RoundedBox>
    {[0, 1, 2, 3].map((k) => (
      <RoundedBox key={k} args={[0.5, 0.36, 0.05]} radius={0.015} position={[0, 0.5 + k * 0.5, 0.055]} castShadow>
        <Matte c="#11151B" metal={0.3} rough={0.4} />
      </RoundedBox>
    ))}
    <mesh position={[0, 0.24, 0.037]}>
      <boxGeometry args={[0.7, 0.08, 0.004]} />
      <meshStandardMaterial color={P.gold} metalness={0.95} roughness={0.25} />
    </mesh>
    <mesh position={[0, 0.16 + 2.42, 0]}>
      <boxGeometry args={[0.78, 0.05, 0.09]} />
      {glow(led, ledK)}
    </mesh>
  </group>
);
/** Dashed outline of a stick: memory that has been ordered but not made yet. */
const GHOST = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.78, 2.4, 0.07));
const GhostStick: React.FC<{ p: V; a: number }> = ({ p, a }) =>
  a <= 0.01 ? null : (
    <group position={p}>
      <lineSegments geometry={GHOST} position={[0, 1.36, 0]}>
        <lineBasicMaterial color="#8FD8FF" transparent opacity={0.9 * a} toneMapped={false} />
      </lineSegments>
      <mesh position={[0, 1.36, 0]}>
        <boxGeometry args={[0.78, 2.4, 0.07]} />
        <meshStandardMaterial color="#5FB8FF" emissive="#5FB8FF" emissiveIntensity={0.5} transparent opacity={0.1 * a} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );

/** R3 server stack: slabs with cyan stripes (the AI data centre). */
const ServerStack: React.FC<{ p: V; n?: number; w?: number; stripe?: string; k?: number }> = ({ p, n = 4, w = 1.3, stripe = P.cyan, k = 2 }) => (
  <group position={p}>
    {Array.from({ length: n }, (_, i) => (
      <group key={i} position={[0, i * 0.42, 0]}>
        <RoundedBox args={[w, 0.36, w]} radius={0.03} position={[0, 0.18, 0]} castShadow receiveShadow>
          <Matte />
        </RoundedBox>
        {[-0.08, 0.04].map((y) => (
          <group key={y}>
            <mesh position={[w / 2 + 0.003, 0.18 + y, 0]}>
              <boxGeometry args={[0.005, 0.035, w * 0.72]} />
              {glow(stripe, k)}
            </mesh>
            <mesh position={[0, 0.18 + y, w / 2 + 0.003]}>
              <boxGeometry args={[w * 0.72, 0.035, 0.005]} />
              {glow(stripe, k)}
            </mesh>
          </group>
        ))}
      </group>
    ))}
  </group>
);

/** Chip factory: block, window rows, stacks with steam, coloured edge band. */
const Fab: React.FC<{ p: V; accent: string; frame: number }> = ({ p, accent, frame }) => (
  <group position={p}>
    <Block p={[0, 0, 0]} s={[1.5, 1.0, 1.3]} edge={accent} edgeK={1.8} />
    {[0, 1].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <mesh key={`${r}${c}`} position={[-0.48 + c * 0.32, 0.32 + r * 0.3, 0.652]}>
          <planeGeometry args={[0.2, 0.14]} />
          {glow(accent, 0.8)}
        </mesh>
      )),
    )}
    {[-0.35, 0.35].map((x, k) => (
      <group key={x}>
        <mesh position={[x, 1.3, -0.25]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.6, 16]} />
          <Matte c="#3A4558" />
        </mesh>
        {Array.from({ length: 3 }, (_, j) => {
          const u = ((frame / FPS) * 0.45 + j / 3 + k * 0.4) % 1;
          return (
            <mesh key={j} position={[x + u * 0.12, 1.65 + u * 0.7, -0.25]}>
              <sphereGeometry args={[0.07 + u * 0.12, 12, 12]} />
              <meshStandardMaterial color="#C9D2DE" transparent opacity={0.28 * (1 - u)} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    ))}
  </group>
);

/** Graphics card block (Nvidia): long shroud, three fans on top, green edge light. */
const GpuBlock: React.FC<{ p: V; t: number }> = ({ p, t }) => (
  <group position={p}>
    <Block p={[0, 0, 0]} s={[1.9, 0.18, 1.0]} c="#1A222D" />
    <RoundedBox args={[1.7, 0.36, 0.8]} radius={0.05} smoothness={4} position={[0, 0.36, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#242A33" metalness={0.6} roughness={0.35} />
    </RoundedBox>
    {[-0.55, 0, 0.55].map((x, k) => (
      <group key={x} position={[x, 0.545, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.24, 40]} />
          <meshStandardMaterial color="#3A414C" metalness={0.6} roughness={0.3} />
        </mesh>
        <group rotation={[0, t * 8 + k, 0]}>
          {Array.from({ length: 7 }, (_, j) => (
            <mesh key={j} rotation={[-Math.PI / 2, 0, (j / 7) * Math.PI * 2]} position={[Math.cos((j / 7) * Math.PI * 2) * 0.1, 0.004, -Math.sin((j / 7) * Math.PI * 2) * 0.1]}>
              <planeGeometry args={[0.16, 0.06]} />
              <meshStandardMaterial color="#1A1E24" side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      </group>
    ))}
    {[0.4, -0.4].map((z) => (
      <mesh key={z} position={[0, 0.48, z * 1.01]}>
        <boxGeometry args={[1.6, 0.03, 0.02]} />
        {glow(P.nvidia, 2.4)}
      </mesh>
    ))}
  </group>
);

const MoneySack: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <group scale={s}>
    <mesh position={[0, 0.3, 0]} scale={[1, 0.92, 0.92]} castShadow>
      <sphereGeometry args={[0.3, 22, 18]} />
      <meshStandardMaterial color="#C9A66B" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.6, 0]} castShadow>
      <cylinderGeometry args={[0.06, 0.12, 0.1, 14]} />
      <meshStandardMaterial color="#B8945A" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.68, 0]}>
      <coneGeometry args={[0.1, 0.12, 12]} />
      <meshStandardMaterial color="#B8945A" roughness={0.9} />
    </mesh>
    {DOLLAR_TEX ? (
      <mesh position={[0, 0.32, 0.28]}>
        <planeGeometry args={[0.26, 0.26]} />
        <meshStandardMaterial map={DOLLAR_TEX} transparent roughness={0.9} />
      </mesh>
    ) : null}
  </group>
);
const ChipTile: React.FC<{ p: THREE.Vector3; s?: number; tint?: string }> = ({ p, s = 1, tint }) => (
  <group position={p.toArray() as V} scale={s}>
    <RoundedBox args={[0.42, 0.05, 0.42]} radius={0.012} castShadow>
      <meshStandardMaterial color={tint ?? "#C7CFDD"} metalness={0.5} roughness={0.35} />
    </RoundedBox>
    {CHIP_TEX && !tint ? (
      <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.38, 0.38]} />
        <meshStandardMaterial map={CHIP_TEX} metalness={0.4} roughness={0.3} />
      </mesh>
    ) : null}
    {tint ? (
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 0.2]} />
        {glow(tint, 1.6)}
      </mesh>
    ) : null}
  </group>
);
/** A lane on the floor: dashed line with chevrons pointing the way things travel. */
const Lane: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; color: string; t: number }> = ({ a, b, color, t }) => {
  const d = b.clone().sub(a);
  const ang = Math.atan2(d.x, d.z);
  return (
    <group>
      <Line points={[[a.x, 0.012, a.z], [b.x, 0.012, b.z]]} color={color} lineWidth={2} dashed dashSize={0.12} gapSize={0.1} transparent opacity={0.55} />
      {Array.from({ length: 4 }, (_, k) => {
        const u = (k / 4 + t * 0.25) % 1;
        const p = a.clone().lerp(b, u);
        return (
          <mesh key={k} position={[p.x, 0.014, p.z]} rotation={[-Math.PI / 2, 0, ang + Math.PI]}>
            <circleGeometry args={[0.09, 3]} />
            {glow(color, 1.4, 0.7)}
          </mesh>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- the shots
const ROW = [-2.0, -1.0, 0, 1.0, 2.0];

/** 1. Hook: a row of RAM sticks; their lights go from cyan to red as the price quadruples. */
const PriceSet: React.FC<{ t: number; x4: number }> = ({ t, x4 }) => {
  const heat = smooth(ramp(x4, 0, 1.2));
  return (
    <group>
      {ROW.map((x, k) => {
        const h = smooth(ramp(x4, k * 0.12, k * 0.12 + 0.5));
        const led = h > 0 ? mix(P.amber, P.red, h) : P.cyan;
        return (
          <group key={k}>
            <Pool p={[x, 0, 0.3]} r={0.9} color={h > 0 ? led : P.cyan} k={0.7 + 0.5 * heat} />
            <RamStick p={[x, 0, 0]} led={led} ledK={2.2 + 1.5 * h * Math.abs(Math.sin(t * 6 + k))} />
          </group>
        );
      })}
    </group>
  );
};

/** 2. Reason: sticks slide into the AI data centre; ordered-but-not-made outlines follow. */
const DC_R = v3(3.2, 0, 0);
const ReasonSet: React.FC<{ t: number; buy: number; vanish: number }> = ({ t, buy, vanish }) => (
  <group>
    <Pool p={[DC_R.x, 0, DC_R.z]} r={1.3} color={P.cyan} k={0.8} />
    <ServerStack p={[DC_R.x, 0, DC_R.z]} n={5} w={1.3} />
    {ROW.map((x, k) => {
      const go = smooth(ramp(buy, k * 0.1, k * 0.1 + 0.9));
      const px = x + (DC_R.x - x) * go;
      const s = 1 - 0.75 * smooth(ramp(go, 0.7, 1));
      return go < 0.999 ? <RamStick key={k} p={[px, 0, 0]} s={s} led={P.red} /> : null;
    })}
    {ROW.map((x, k) => {
      const a = smooth(ramp(vanish, k * 0.08, k * 0.08 + 0.35));
      const go = smooth(ramp(vanish, 0.6 + k * 0.08, 1.6 + k * 0.08));
      const px = x + (DC_R.x - x) * go;
      return <GhostStick key={`g${k}`} p={[px, 0, 0]} a={a * (1 - smooth(ramp(go, 0.75, 1)))} />;
    })}
    {void t}
  </group>
);

/** 3. Deal: Samsung + SK Hynix fabs send chips along lanes to OpenAI's Stargate. */
const DC_D = v3(-1.4, 0, -1.4);
const FAB_S = v3(0.6, 0, 2.2);
const FAB_H = v3(2.2, 0, 0.6);
const DealSet: React.FC<{ t: number; frame: number; share: number }> = ({ t, frame, share }) => {
  const lanes: [THREE.Vector3, THREE.Vector3][] = [
    [v3(FAB_S.x - 0.4, 0, FAB_S.z - 0.8), v3(DC_D.x + 0.4, 0, DC_D.z + 0.9)],
    [v3(FAB_H.x - 0.9, 0, FAB_H.z - 0.3), v3(DC_D.x + 0.9, 0, DC_D.z + 0.4)],
  ];
  const lit = smooth(ramp(share, 0, 0.6));
  return (
    <group>
      <Pool p={[DC_D.x, 0, DC_D.z]} r={1.5} color={lit > 0 ? P.amber : P.cyan} k={0.8} />
      <ServerStack p={[DC_D.x, 0, DC_D.z]} n={4} w={1.4} stripe={lit > 0 ? mix(P.cyan, P.amber, lit) : P.cyan} />
      <Pool p={[FAB_S.x, 0, FAB_S.z]} r={1.1} color="#4C7DFF" k={0.6} />
      <Fab p={[FAB_S.x, 0, FAB_S.z]} accent="#5B8CFF" frame={frame} />
      <Pool p={[FAB_H.x, 0, FAB_H.z]} r={1.1} color="#FF5B5B" k={0.6} />
      <Fab p={[FAB_H.x, 0, FAB_H.z]} accent="#FF6A5B" frame={frame} />
      {lanes.map(([a, b], li) => (
        <group key={li}>
          <Lane a={a} b={b} color={P.cyan} t={t} />
          {Array.from({ length: 4 }, (_, k) => {
            const u = (t * 0.3 + k / 4 + li * 0.12) % 1;
            const edge = Math.min(1, u / 0.1, (1 - u) / 0.1);
            return <ChipTile key={k} p={a.clone().lerp(b, u).setY(0.04)} s={edge} />;
          })}
        </group>
      ))}
    </group>
  );
};

/** 4. Loop: chips go Nvidia -> OpenAI (top lane); sacks of money come back (bottom lane). */
const NV = v3(-1.3, 0, 1.3);
const OA = v3(1.3, 0, -1.3);
const LoopSet: React.FC<{ t: number; stake: number }> = ({ t, stake }) => {
  const d = OA.clone().sub(NV).normalize();
  const n = v3(-d.z, 0, d.x); // side offset between the two lanes
  const chipsA = NV.clone().add(d.clone().multiplyScalar(1.1)).add(n.clone().multiplyScalar(-0.62));
  const chipsB = OA.clone().sub(d.clone().multiplyScalar(1.0)).add(n.clone().multiplyScalar(-0.62));
  const cashA = OA.clone().sub(d.clone().multiplyScalar(1.0)).add(n.clone().multiplyScalar(0.62));
  const cashB = NV.clone().add(d.clone().multiplyScalar(1.1)).add(n.clone().multiplyScalar(0.62));
  // The $30B stake: one big sack arcs from Nvidia to OpenAI when it is said.
  const st = smooth(ramp(stake, 0, 1.4));
  const arc = new THREE.QuadraticBezierCurve3(NV.clone().setY(1.0), NV.clone().lerp(OA, 0.5).setY(2.2), OA.clone().setY(1.9));
  return (
    <group>
      <Pool p={[NV.x, 0, NV.z]} r={1.2} color={P.nvidia} k={0.8} />
      <GpuBlock p={[NV.x, 0, NV.z]} t={t} />
      <Pool p={[OA.x, 0, OA.z]} r={1.2} color={P.cyan} k={0.8} />
      <ServerStack p={[OA.x, 0, OA.z]} n={4} w={1.2} />
      <Lane a={chipsA} b={chipsB} color={P.nvidia} t={t} />
      <Lane a={cashA} b={cashB} color={P.amber} t={t} />
      {Array.from({ length: 4 }, (_, k) => {
        const u = (t * 0.32 + k / 4) % 1;
        const edge = Math.min(1, u / 0.1, (1 - u) / 0.1);
        return <ChipTile key={`c${k}`} p={chipsA.clone().lerp(chipsB, u).setY(0.04)} s={edge} tint={P.nvidia} />;
      })}
      {Array.from({ length: 3 }, (_, k) => {
        const u = (t * 0.28 + k / 3 + 0.15) % 1;
        const edge = Math.min(1, u / 0.12, (1 - u) / 0.12);
        const p = cashA.clone().lerp(cashB, u);
        return (
          <group key={`m${k}`} position={[p.x, 0, p.z]} scale={edge * 0.75}>
            <MoneySack />
          </group>
        );
      })}
      {stake >= 0 && st < 1 ? (
        <group position={arc.getPoint(st).toArray() as V} scale={1.2}>
          <MoneySack />
        </group>
      ) : null}
    </group>
  );
};

/** 5. Flower shop: money goes to the shop, flowers come to the customer; then the bank. */
const SHOP = v3(-1.3, 0, 1.3);
const YOU = v3(1.5, 0, -0.2);
const BANK = v3(-0.6, 0, -1.9);
const FLOWER_COLORS = ["#E86A8A", "#F2C14E", "#D9536A", "#B57BE0", "#F59B5A"];
const Bunch: React.FC<{ p: THREE.Vector3; s?: number }> = ({ p, s = 1 }) => (
  <group position={p.toArray() as V} scale={s}>
    <mesh position={[0, 0.12, 0]}>
      <coneGeometry args={[0.09, 0.24, 10]} />
      <meshStandardMaterial color="#E9E1D2" roughness={0.8} />
    </mesh>
    {[0, 1, 2, 3].map((j) => (
      <mesh key={j} position={[Math.cos(j * 1.6) * 0.06, 0.3 + (j % 2) * 0.03, Math.sin(j * 1.6) * 0.06]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color={FLOWER_COLORS[j]} emissive={FLOWER_COLORS[j]} emissiveIntensity={0.25} />
      </mesh>
    ))}
  </group>
);
const FlowerSet: React.FC<{ t: number; bank: number }> = ({ t, bank }) => {
  const d = YOU.clone().sub(SHOP).normalize();
  const n = v3(-d.z, 0, d.x);
  const flA = SHOP.clone().add(d.clone().multiplyScalar(0.9)).add(n.clone().multiplyScalar(-0.55));
  const flB = YOU.clone().sub(d.clone().multiplyScalar(0.55)).add(n.clone().multiplyScalar(-0.55));
  const mA = YOU.clone().sub(d.clone().multiplyScalar(0.55)).add(n.clone().multiplyScalar(0.55));
  const mB = SHOP.clone().add(d.clone().multiplyScalar(0.9)).add(n.clone().multiplyScalar(0.55));
  const toBank = smooth(ramp(bank, 0, 0.6));
  return (
    <group>
      {/* shop: block with striped awning and flower pots */}
      <Pool p={[SHOP.x, 0, SHOP.z]} r={1.1} color="#E86A8A" k={0.6} />
      <Block p={[SHOP.x, 0, SHOP.z]} s={[1.3, 0.8, 1.0]} c="#2A3443" />
      {Array.from({ length: 6 }, (_, k) => (
        <mesh key={k} position={[SHOP.x - 0.55 + k * 0.22, 0.95, SHOP.z + 0.35]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.22, 0.03, 0.5]} />
          <meshStandardMaterial color={k % 2 ? "#F0F0F2" : "#D9536A"} roughness={0.6} />
        </mesh>
      ))}
      {Array.from({ length: 4 }, (_, k) => (
        <Bunch key={k} p={v3(SHOP.x - 0.45 + k * 0.3, 0.8, SHOP.z - 0.15)} />
      ))}
      {/* customer (R2-style voxel figure) */}
      <group position={YOU.toArray() as V}>
        <Pool p={[0, 0, 0]} r={0.7} color={P.cyan} k={0.5} />
        <RoundedBox args={[0.42, 0.7, 0.3]} radius={0.06} position={[0, 0.55, 0]} castShadow>
          <Matte c="#5B7DB8" />
        </RoundedBox>
        <RoundedBox args={[0.3, 0.3, 0.3]} radius={0.06} position={[0, 1.08, 0]} castShadow>
          <Matte c="#E2C3A3" />
        </RoundedBox>
        {[-0.1, 0.1].map((x) => (
          <RoundedBox key={x} args={[0.14, 0.22, 0.16]} radius={0.03} position={[x, 0.11, 0]} castShadow>
            <Matte c="#2C3442" />
          </RoundedBox>
        ))}
      </group>
      {/* bank */}
      <group position={BANK.toArray() as V}>
        <Pool p={[0, 0, 0]} r={1.0} color={P.amber} k={toBank * 0.8} />
        <Block p={[0, 0, 0]} s={[1.3, 0.12, 0.9]} />
        {[-0.45, -0.15, 0.15, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.45, 0.3]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.66, 12]} />
            <Matte c={P.light} rough={0.5} />
          </mesh>
        ))}
        <Block p={[0, 0.12, -0.12]} s={[1.1, 0.66, 0.55]} />
        <Block p={[0, 0.78, 0]} s={[1.4, 0.1, 1.0]} c={P.light} />
        <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 1.4, 3]} />
          <Matte c={P.light} rough={0.5} />
        </mesh>
      </group>
      <Lane a={mA} b={mB} color={P.amber} t={t} />
      <Lane a={flA} b={flB} color="#E86A8A" t={t} />
      {Array.from({ length: 3 }, (_, k) => {
        const u = (t * 0.3 + k / 3) % 1;
        const edge = Math.min(1, u / 0.12, (1 - u) / 0.12);
        const p = mA.clone().lerp(mB, u);
        return (
          <group key={`m${k}`} position={[p.x, 0, p.z]} scale={edge * 0.6}>
            <MoneySack />
          </group>
        );
      })}
      {Array.from({ length: 3 }, (_, k) => {
        const u = (t * 0.3 + k / 3 + 0.15) % 1;
        const edge = Math.min(1, u / 0.12, (1 - u) / 0.12);
        return <Bunch key={`f${k}`} p={flA.clone().lerp(flB, u).setY(0.02)} s={edge * 1.2} />;
      })}
      {bank >= 0 ? (
        <Line points={[[SHOP.x, 1.0, SHOP.z - 0.4], [BANK.x + (SHOP.x - BANK.x) * (1 - toBank), 1.0, BANK.z + 0.5 + (SHOP.z - 0.4 - BANK.z - 0.5) * (1 - toBank)]]} color={P.amber} lineWidth={3} dashed dashSize={0.12} gapSize={0.08} />
      ) : null}
    </group>
  );
};

/** 6. Math: $2T needed vs revenue on track; the red $800B gap arrives just before it is said. */
const GAP_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 1.28, 1.0));
const MathSet: React.FC<{ t: number; gap: number }> = ({ t, gap }) => {
  const need = 3.2 * smooth(ramp(t, 0.6, 1.8));
  const have = 3.2 * 0.6 * smooth(ramp(t, 1.6, 2.8));
  const g = smooth(ramp(gap, -0.75, -0.4));
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(gap * 6));
  return (
    <group>
      <Pool p={[-0.8, 0, 0.8]} r={1.0} color={P.amber} k={0.7} />
      <Pool p={[0.8, 0, -0.8]} r={1.0} color={g > 0 ? P.red : P.cyan} k={0.7} />
      {need > 0.01 ? <Block p={[-0.8, 0, 0.8]} s={[1.0, need, 1.0]} c="#3A3424" edge={P.amber} edgeK={2.2} /> : null}
      {have > 0.01 ? <Block p={[0.8, 0, -0.8]} s={[1.0, have, 1.0]} c="#1F3444" edge={P.cyan} edgeK={2.2} /> : null}
      {g > 0.01 ? (
        <group position={[0.8, 3.2 * 0.6 + 0.64, -0.8]} scale={[1, g, 1]}>
          <lineSegments geometry={GAP_EDGES}>
            <lineBasicMaterial color={P.red} toneMapped={false} />
          </lineSegments>
          <mesh>
            <boxGeometry args={[1.0, 1.28, 1.0]} />
            <meshStandardMaterial color={P.red} emissive={P.red} emissiveIntensity={0.5 + 0.5 * pulse} transparent opacity={0.22 * g} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

/** 7. Bubble: a RAM stick under a shimmering dome; a pin creeps in; it pops on "crash". */
const BubbleSet: React.FC<{ t: number; pop: number; frame: number }> = ({ t, pop, frame }) => {
  const popped = pop >= 0;
  const burst = clamp01(pop / 0.5);
  const wob = 1 + 0.03 * Math.sin(frame * 0.25);
  const sheen = new THREE.Color().setHSL((frame * 0.004) % 1, 0.6, 0.7);
  const pin = popped ? 1.55 : 3.0 - 1.35 * smooth(ramp(t, 0.3, 3.6));
  return (
    <group>
      <Pool p={[0, 0, 0]} r={1.6} color={popped ? P.green : P.amber} k={0.9} />
      <Block p={[0, 0, 0]} s={[1.3, 0.2, 1.3]} edge={popped ? P.green : P.amber} />
      <RamStick p={[0, 0.2, 0]} s={0.75} led={popped ? P.green : P.red} />
      {Array.from({ length: 5 }, (_, k) => {
        const a = t * 1.3 + (k / 5) * Math.PI * 2;
        if (popped && burst >= 1) return null;
        return (
          <mesh key={k} position={[Math.cos(a) * 1.05, 1.3 + Math.sin(a * 2) * 0.25 - (popped ? burst * 1.3 : 0), Math.sin(a) * 1.05]} rotation={[Math.PI / 2, 0, a]}>
            <cylinderGeometry args={[0.1, 0.1, 0.025, 20]} />
            <meshStandardMaterial color="#E9B949" metalness={0.85} roughness={0.3} emissive="#7A5A10" emissiveIntensity={0.4} />
          </mesh>
        );
      })}
      {!popped || burst < 1 ? (
        <group position={[0, 1.35, 0]} scale={popped ? 1 + burst * 0.4 : wob}>
          <mesh>
            <sphereGeometry args={[1.45, 48, 48]} />
            <meshStandardMaterial color={sheen} transparent opacity={(popped ? 1 - burst : 1) * 0.07} roughness={0.05} metalness={0.3} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.47, 48, 48]} />
            <meshStandardMaterial color="#9FD8FF" emissive={sheen} emissiveIntensity={0.8} transparent opacity={(popped ? 1 - burst : 1) * 0.1} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      <group position={[pin, 1.75, 0.6]} rotation={[0, 0.5, Math.PI / 2 + 0.3]}>
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.014, 0.004, 0.8, 10]} />
          <meshStandardMaterial color="#D9DFE8" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <Matte c={P.red} rough={0.4} />
        </mesh>
      </group>
      {popped && pop < 0.8 ? (
        <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1 + pop * 2.5}>
          <torusGeometry args={[1.45, 0.025, 8, 64]} />
          {glow("#CFEAFF", 3, 1 - pop / 0.8)}
        </mesh>
      ) : null}
      {popped && pop < 1.3
        ? Array.from({ length: 40 }, (_, k) => {
            const a = random(`ba${k}`) * Math.PI * 2;
            const e = (random(`be${k}`) - 0.5) * Math.PI;
            const r = 1.45 + burst * (1.0 + random(`br${k}`));
            return (
              <mesh key={k} position={[Math.cos(a) * Math.cos(e) * r, 1.35 + Math.sin(e) * r - pop * pop * 0.8, Math.sin(a) * Math.cos(e) * r]}>
                <sphereGeometry args={[0.03, 6, 6]} />
                {glow("#BFE8FF", 3, 1 - clamp01(pop / 1.3))}
              </mesh>
            );
          })
        : null}
    </group>
  );
};

/** 8. End: everything else gone, one stick on a pedestal; it lights green on "real". */
const EndSet: React.FC<{ t: number; real: number }> = ({ t, real }) => {
  const lit = smooth(ramp(real, 0.1, 0.7));
  const fade = 1 - smooth(ramp(real, 0, 0.8));
  return (
    <group>
      {[
        [-1.1, -0.9],
        [1.0, -1.1],
        [-0.9, 1.1],
        [1.1, 0.9],
      ].map(([x, z], k) => (
        <GhostStick key={k} p={[x, 0, z]} a={fade * 0.8} />
      ))}
      <Pool p={[0, 0, 0]} r={1.4} color={lit > 0 ? P.green : P.cyan} k={0.7 + lit * 0.6} />
      <Block p={[0, 0, 0]} s={[1.1, 0.24, 1.1]} edge={lit > 0 ? P.green : P.cyan} edgeK={2 + 2 * lit} />
      <group rotation={[0, Math.sin(t * 0.6) * 0.3, 0]}>
        <RamStick p={[0, 0.24, 0]} s={0.95} led={lit > 0 ? P.green : P.cyan} ledK={2.2 + 2 * lit} />
      </group>
      {lit > 0
        ? Array.from({ length: 18 }, (_, k) => {
            const a = (k / 18) * Math.PI * 2 + t * 0.6;
            const y = 0.3 + ((t * 0.5 + random(`sy${k}`)) % 1) * 2.4;
            return (
              <mesh key={k} position={[Math.cos(a) * 0.85, y, Math.sin(a) * 0.85]}>
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
const Rig: React.FC<{ fit: Fit }> = ({ fit }) => {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  camera.position.copy(fit.pos);
  camera.zoom = fit.zoom;
  camera.lookAt(fit.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};

const World: React.FC<{ beats: Beats; frame: number; fit: Fit }> = ({ beats, frame, fit }) => {
  const b = current(beats, frame);
  const t = since(beats, frame, b);
  return (
    <>
      <color attach="background" args={[P.bg]} />
      <Rig fit={fit} />
      {/* soft key light from above-left: lit tops, shaded sides (R4) */}
      <ambientLight color="#8EA2C8" intensity={0.32} />
      <hemisphereLight args={["#A9BEE6", "#0B1018", 0.7]} />
      <directionalLight
        position={[-7, 14, 5]}
        intensity={2.1}
        color="#F2F5FF"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={50}
      />
      <directionalLight position={[8, 6, 9]} intensity={0.4} color="#9FB8FF" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={P.floor} roughness={0.92} metalness={0.05} />
      </mesh>
      <gridHelper args={[60, 60, P.grid1, P.grid2]} position={[0, 0.003, 0]} />
      {b === "price" ? <PriceSet t={t} x4={since(beats, frame, "x4")} /> : null}
      {b === "reason" ? <ReasonSet t={t} buy={since(beats, frame, "buy")} vanish={since(beats, frame, "vanish")} /> : null}
      {b === "deal" ? <DealSet t={t} frame={frame} share={since(beats, frame, "share")} /> : null}
      {b === "loop" ? <LoopSet t={t} stake={since(beats, frame, "stake")} /> : null}
      {b === "flower" ? <FlowerSet t={t} bank={since(beats, frame, "bank")} /> : null}
      {b === "math" ? <MathSet t={t} gap={since(beats, frame, "gap")} /> : null}
      {b === "bubble" ? <BubbleSet t={t} pop={since(beats, frame, "pop")} frame={frame} /> : null}
      {b === "end" ? <EndSet t={t} real={since(beats, frame, "real")} /> : null}
      <WarmUp />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={0.9} />
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
      </EffectComposer>
    </>
  );
};

// ---------------------------------------------------------------- 2D layer (zones never cover the 3D band)
const projector = (fit: Fit) => {
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 200);
  cam.position.copy(fit.pos);
  cam.zoom = fit.zoom;
  cam.lookAt(fit.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return (p: THREE.Vector3) => {
    const q = p.clone().project(cam);
    return { x: (q.x * 0.5 + 0.5) * W, y: (1 - (q.y * 0.5 + 0.5)) * H };
  };
};

/** R3 chapter tabs: current filled, finished outlined, upcoming hidden. */
const Tabs: React.FC<{ active: number }> = ({ active }) => {
  const w = 160;
  const x0 = 540 - (w * CHAPTERS.length) / 2;
  return (
    <g>
      {CHAPTERS.map((c, i) =>
        i > active ? null : (
          <g key={c} transform={`translate(${x0 + i * w} 300)`}>
            <rect x={4} y={-24} width={w - 8} height={48} rx={4} fill={i === active ? K.cyan : K.panel} stroke={i === active ? "none" : "rgba(255,255,255,0.5)"} strokeWidth={2} />
            <text x={w / 2} y={8} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={20} fill={i === active ? "#081020" : K.white} letterSpacing={1}>
              {c}
            </text>
          </g>
        ),
      )}
    </g>
  );
};

/** R4 status bar: label pill, segment lights, value. */
const Status: React.FC<{ y: number; label: string; lights: string[]; value: string; tone: string; s: number }> = ({ y, label, lights, value, tone, s }) =>
  s <= 0.01 ? null : (
    <g opacity={s}>
      <rect x={110} y={y - 26} width={170} height={52} rx={26} fill={K.panel} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
      <text x={195} y={y + 8} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={21} fill={K.white}>
        {label}
      </text>
      {lights.map((c, k) => (
        <rect key={k} x={298 + k * 40} y={y - 16} width={30} height={32} rx={4} fill={c} filter="url(#kglow)" />
      ))}
      <text x={298 + lights.length * 40 + 14} y={y + 10} fontFamily={MONO} fontWeight={700} fontSize={28} fill={tone}>
        {value}
      </text>
    </g>
  );

/** Card in the lower band (y 1180-1300). */
const Card: React.FC<{ s: number; children: React.ReactNode; h?: number }> = ({ s, children, h = 110 }) =>
  s <= 0.01 ? null : (
    <g opacity={s} transform={`translate(0 ${(1 - s) * 30})`}>
      <rect x={130} y={1185} width={820} height={h} rx={14} fill={K.panel} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
      {children}
    </g>
  );

const Overlay: React.FC<{ beats: Beats; frame: number; fit: Fit }> = ({ beats, frame, fit }) => {
  const proj = projector(fit);
  const b = current(beats, frame);
  const t = since(beats, frame, b);
  const sAt = (d: number, len = 0.3) => smooth(ramp(t, d, d + len));
  const flash = b !== "price" ? clamp01(1 - t / 0.16) : 0;
  const x4 = since(beats, frame, "x4");
  const buy = since(beats, frame, "buy");
  const vanish = since(beats, frame, "vanish");
  const share = since(beats, frame, "share");
  const stake = since(beats, frame, "stake");
  const bank = since(beats, frame, "bank");
  const gap = since(beats, frame, "gap");
  const pop = since(beats, frame, "pop");
  const real = since(beats, frame, "real");
  /** Label pinned beside a 3D point; kept inside the 3D band. */
  const pin = (p: THREE.Vector3, text: string, tone: "cyan" | "amber" | "green" | "red" | "plain", s: number, dx: number, dy: number) => {
    const a = proj(p);
    return <Callout x={a.x} y={a.y} tx={Math.max(220, Math.min(860, a.x + dx))} ty={Math.max(BAND.top + 20, Math.min(BAND.bottom - 20, a.y + dy))} text={text} tone={tone} s={s} />;
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <KitDefs />
      <Tabs active={CHAPTER_OF[b]} />

      {b === "price" ? (
        <>
          <TitleCard y={430} line1="WHY IS RAM" line2="SO EXPENSIVE?" accent={K.amber} s={1 - smooth(ramp(t, 2.6, 3.0))} />
          {(() => {
            const u = smooth(ramp(x4, 0, 1.4));
            const lights = Array.from({ length: 8 }, (_, k) => (u * 8 > k ? mix(P.amber, P.red, k / 7) : "#26304A"));
            const mult = 1 + 3 * u;
            return <Status y={470} label="RAM PRICE" lights={lights} value={`×${mult.toFixed(1)}`} tone={u > 0.95 ? K.red : K.amber} s={smooth(ramp(t, 2.8, 3.1))} />;
          })()}
          <Card s={smooth(ramp(x4, 0.4, 0.7))}>
            <text x={160} y={1232} fontFamily={BODY} fontWeight={900} fontSize={24} fill={K.white}>DDR5 CHIP SPOT PRICE</text>
            <text x={160} y={1274} fontFamily={MONO} fontWeight={700} fontSize={30} fill={K.amber}>$6.84 → $27.20</text>
            <text x={920} y={1274} textAnchor="end" fontFamily={MONO} fontSize={17} fill={K.muted}>SEP → DEC 2025 · TOM'S HARDWARE</text>
          </Card>
        </>
      ) : null}

      {b === "reason" ? (
        <>
          <Status
            y={470}
            label="RAM STOCK"
            lights={Array.from({ length: 8 }, (_, k) => (k < 8 - Math.round(8 * smooth(ramp(buy, 0, 1.2))) ? K.cyan : "#26304A"))}
            value={vanish >= 0 ? "SOLD OUT" : buy >= 0 ? "SELLING" : "IN STOCK"}
            tone={buy >= 0 ? K.red : K.cyan}
            s={1}
          />
          {pin(v3(DC_R.x, 2.2, DC_R.z), "AI DATA CENTRE", "cyan", smooth(ramp(buy, -0.3, 0)), -40, -160)}
          {pin(v3(-1.0, 2.7, 0), "NOT MADE YET", "plain", smooth(ramp(vanish, 0.2, 0.5)), -60, -120)}
        </>
      ) : null}

      {b === "deal" ? (
        <>
          {share >= 0 ? (
            <BigStat x={540} y={510} value={`${Math.round(40 * smooth(ramp(share, 0, 0.6)))}%`} label="OF WORLD DRAM SUPPLY · ANALYST ESTIMATE" color={K.amber} size={130} s={smooth(ramp(share, 0, 0.3))} />
          ) : (
            <Status y={470} label="WAFERS" lights={Array.from({ length: 8 }, (_, k) => (k < Math.min(8, Math.round(t * 2)) ? K.cyan : "#26304A"))} value="900K / MONTH" tone={K.cyan} s={sAt(0.3)} />
          )}
          {pin(v3(DC_D.x, 1.7, DC_D.z), "OPENAI · STARGATE", "cyan", sAt(0.3), -40, -140)}
          {pin(v3(FAB_S.x, 1.1, FAB_S.z), "SAMSUNG", "plain", sAt(0.6), -150, 90)}
          {pin(v3(FAB_H.x, 1.1, FAB_H.z), "SK HYNIX", "plain", sAt(0.9), 110, 120)}
          <Card s={sAt(1.4)}>
            <text x={160} y={1228} fontFamily={BODY} fontWeight={900} fontSize={22} fill={K.white}>WORLD DRAM SUPPLY</text>
            {Array.from({ length: 20 }, (_, k) => (
              <rect key={k} x={160 + k * 38} y={1246} width={30} height={30} rx={3} fill={k < 8 && share >= 0 && smooth(ramp(share, 0.2 + k * 0.05, 0.4 + k * 0.05)) > 0.5 ? K.amber : "#26304A"} filter={k < 8 && share >= 0 ? "url(#kglow)" : undefined} />
            ))}
            <text x={920} y={1228} textAnchor="end" fontFamily={MONO} fontSize={17} fill={K.muted}>LETTERS OF INTENT · OCT 1, 2025</text>
          </Card>
        </>
      ) : null}

      {b === "loop" ? (
        <>
          <Status y={470} label="MONEY LOOP" lights={Array.from({ length: 8 }, (_, k) => ((k + Math.floor(t * 6)) % 8 < 3 ? K.green : "#26304A"))} value={stake >= 0 ? "$30B IN" : "CIRCULAR"} tone={K.green} s={sAt(0.2)} />
          {pin(v3(NV.x, 0.6, NV.z), "NVIDIA", "green", sAt(0.3), -130, 110)}
          {pin(v3(OA.x, 1.7, OA.z), "OPENAI", "cyan", sAt(0.5), 60, -150)}
          <Card s={sAt(1.0)}>
            <rect x={160} y={1210} width={26} height={26} rx={3} fill={P.nvidia} />
            <text x={198} y={1232} fontFamily={MONO} fontWeight={700} fontSize={22} fill={K.white}>CHIPS → OPENAI</text>
            <circle cx={573} cy={1223} r={13} fill="#C9A66B" />
            <text x={598} y={1232} fontFamily={MONO} fontWeight={700} fontSize={22} fill={K.white}>$ → NVIDIA</text>
            <text x={160} y={1272} fontFamily={MONO} fontSize={18} fill={K.muted}>FEB 2026 · NVIDIA TOOK A $30B STAKE IN OPENAI</text>
          </Card>
        </>
      ) : null}

      {b === "flower" ? (
        <>
          <Status y={470} label="SHOP VALUE" lights={Array.from({ length: 8 }, (_, k) => (bank >= 0 && smooth(ramp(bank, k * 0.06, k * 0.06 + 0.2)) > 0.5 ? K.amber : "#26304A"))} value={bank >= 0 ? "$1,000,000,000 ?" : "$1,000"} tone={K.amber} s={sAt(0.2)} />
          {pin(v3(SHOP.x, 1.1, SHOP.z), "MY FLOWER SHOP", "plain", sAt(0.3), -100, 130)}
          {pin(v3(YOU.x, 1.3, YOU.z), "YOU", "plain", sAt(0.5), 90, -110)}
          {pin(v3(BANK.x, 1.2, BANK.z), "BANK", "amber", smooth(ramp(bank, 0, 0.3)), -80, -120)}
          <Card s={sAt(0.9)}>
            <text x={160} y={1232} fontFamily={MONO} fontWeight={700} fontSize={22} fill={K.amber}>$1,000 → MY SHOP</text>
            <text x={600} y={1232} fontFamily={MONO} fontWeight={700} fontSize={22} fill="#E86A8A">FLOWERS → YOU</text>
            <text x={160} y={1274} fontFamily={MONO} fontSize={18} fill={K.muted}>SAME MONEY, GOING ROUND · SIMPLIFIED ANALOGY</text>
          </Card>
        </>
      ) : null}

      {b === "math" ? (
        <>
          <Status y={470} label="AI REVENUE" lights={Array.from({ length: 8 }, (_, k) => (k < 5 ? K.cyan : gap > -0.6 ? K.red : "#26304A"))} value={gap > -0.4 ? "$800B SHORT" : "BY 2030"} tone={gap > -0.4 ? K.red : K.cyan} s={sAt(0.2)} />
          {pin(v3(-0.8, 3.25, 0.8), "$2T NEEDED / YEAR", "amber", sAt(1.2), -60, -90)}
          {pin(v3(0.8, 1.2, -0.8), "REVENUE ON TRACK", "cyan", sAt(2.4), 120, 120)}
          {pin(v3(0.8, 2.6, -0.8), "$800B SHORT", "red", smooth(ramp(gap, -0.3, 0)), 130, -80)}
          {(() => {
            const a = proj(v3(0.8, 2.6, -0.8));
            return [
              [-120, -60, -12],
              [110, -120, 10],
              [-80, -170, -6],
              [150, -20, 14],
            ].map(([dx, dy, r], k) => {
              const s = smooth(ramp(gap, 1.3 + k * 0.12, 1.55 + k * 0.12));
              if (s <= 0.01) return null;
              const bob = Math.sin((frame / FPS) * 6 + k) * 6;
              return (
                <text key={k} x={a.x + dx} y={a.y + dy + bob} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={80 * s} fill={K.red} stroke="#000" strokeWidth={6} paintOrder="stroke" transform={`rotate(${r} ${a.x + dx} ${a.y + dy})`}>
                  ?
                </text>
              );
            });
          })()}
          <Card s={sAt(1.6)} h={70}>
            <text x={540} y={1229} textAnchor="middle" fontFamily={MONO} fontSize={19} fill={K.muted}>BAIN & COMPANY · GLOBAL TECHNOLOGY REPORT · SEP 2025</text>
          </Card>
        </>
      ) : null}

      {b === "bubble" ? (
        <>
          <Status
            y={470}
            label="RAM PRICE"
            lights={Array.from({ length: 8 }, (_, k) => (pop >= 0 ? (k < 8 - Math.round(6 * smooth(ramp(pop, 0, 0.8))) ? K.green : "#26304A") : mix(P.amber, P.red, k / 7)))}
            value={pop >= 0 ? "COULD CRASH ▼" : "STAYS HIGH ▲"}
            tone={pop >= 0 ? K.green : K.red}
            s={sAt(0.2)}
          />
          <Card s={sAt(0.6)} h={70}>
            <text x={160} y={1229} fontFamily={MONO} fontWeight={700} fontSize={22} fill={pop >= 0 ? K.muted : K.amber}>BOOM → RAM STAYS EXPENSIVE</text>
            <text x={920} y={1229} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={22} fill={pop >= 0 ? K.green : K.muted}>BUBBLE → CRASH</text>
          </Card>
        </>
      ) : null}

      {b === "end" ? (
        <>
          <TitleCard y={430} line1="ONLY ONE THING" line2="IS REAL" accent={K.green} s={smooth(ramp(real, 0, 0.3)) * (1 - smooth(ramp(t, 4.3, 4.6)))} />
          {pin(v3(0, 1.6, 0), "YOUR RAM", "green", smooth(ramp(real, 0.8, 1.1)), 200, -40)}
          {(() => {
            const sf = smooth(ramp(t, 4.45, 4.75));
            if (sf <= 0.01) return null;
            return (
              <g transform={`translate(540 470) scale(${0.8 + 0.2 * sf})`} opacity={sf}>
                <rect x={-250} y={-55} width={500} height={110} rx={28} fill={K.red} filter="url(#kglow)" />
                <text x={0} y={16} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={46} fill="#fff">
                  + FOLLOW FOR MORE
                </text>
              </g>
            );
          })()}
          <Card s={smooth(ramp(t, 4.45, 4.75))} h={70}>
            <text x={540} y={1232} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={26} fill={K.cyan}>@frontierin60</text>
          </Card>
        </>
      ) : null}

      {flash > 0 ? <rect x={0} y={0} width={W} height={H} fill="#DCEBFF" opacity={0.35 * flash} /> : null}
    </svg>
  );
};

export const RamIso: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const beats = useContext(BeatsContext);
  const fit = shotAt(beats, frame, durationInFrames);
  return (
    <AbsoluteFill style={{ background: P.bg }}>
      <ThreeCanvas
        width={W}
        height={H}
        orthographic
        shadows="soft"
        camera={{ position: fit.pos.toArray() as V, zoom: fit.zoom, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}
        onCreated={logRenderer}
      >
        <World beats={beats} frame={frame} fit={fit} />
      </ThreeCanvas>
      {beats.still === undefined ? <Overlay beats={beats} frame={frame} fit={fit} /> : null}
    </AbsoluteFill>
  );
};
