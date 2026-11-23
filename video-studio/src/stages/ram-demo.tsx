import React, { useContext } from "react";
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Line, MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BeatsContext } from "../beats";
import { BigStat, Callout, ChapterTabs, Disclaimer, K, KitDefs, MONO, TitleCard } from "../kit";
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

const ORDER = ["price", "deal", "loop"] as const;
type Beat = (typeof ORDER)[number];
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
    { p: v3(1.5, 1.35, 3.6), t: v3(0.1, 0.75, 0) },
    { p: v3(2.6, 2.2, 6.4), t: v3(0, 0.65, 0) },
  ],
  deal: [
    { p: v3(7.0, 6.0, 8.5), t: v3(0, 0.4, 0) },
    { p: v3(4.5, 4.6, 9.5), t: v3(0, 0.5, 0) },
  ],
  loop: [
    { p: v3(1.4, 4.4, 11.5), t: v3(0, 0.8, 0) },
    { p: v3(-2.0, 4.0, 11.0), t: v3(0, 0.8, 0) },
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

const PriceSet: React.FC<{ t: number }> = ({ t }) => {
  const heat = smooth(ramp(t, 0.4, 2.8));
  return (
    <group>
      <Box p={[0, 0.22, 0]} s={[3.6, 0.44, 1.2]} c={P.slate} />
      <mesh position={[0, 0.445, 0.6]}>
        <boxGeometry args={[3.4, 0.01, 0.02]} />
        {glow(P.cyan, 2)}
      </mesh>
      <group position={[0, 0.44 - 0.49, 0]}>
        <Dimm heat={heat} />
      </group>
      {/* more sticks behind, out of focus, each with an amber price tag */}
      {[
        [-2.2, -2.4, 0.5],
        [2.4, -3.0, -0.4],
        [-0.4, -4.2, 0.2],
      ].map(([x, z, r], k) => (
        <group key={k}>
          <Dimm heat={heat} p={[x, -0.45, z]} rotY={r} s={0.9} />
          <mesh position={[x + 0.9, 1.45 + Math.sin(t * 2 + k) * 0.05, z + 0.1]} rotation={[0, r, 0.15]}>
            <planeGeometry args={[0.5, 0.28]} />
            {glow(P.amber, 1.2)}
          </mesh>
        </group>
      ))}
    </group>
  );
};

const WAFER = new THREE.CylinderGeometry(0.42, 0.42, 0.025, 48);
const Wafer: React.FC<{ p: V; hue: number }> = ({ p, hue }) => (
  <mesh geometry={WAFER} position={p} castShadow>
    <meshStandardMaterial color={new THREE.Color().setHSL(0.6 + hue * 0.15, 0.25, 0.72)} metalness={0.9} roughness={0.18} />
  </mesh>
);
const DealSet: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const share = 0.4 * smooth(ramp(t, 0.6, 2.4));
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
  return (
    <>
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 9, 26]} />
      <CameraRig pose={pose} />
      {/* R5-style: one soft key light, cool sky fill, no neon as a light source. */}
      <ambientLight color="#9AA8C2" intensity={0.45} />
      <hemisphereLight args={["#C8D6F0", "#1A2230", 0.8]} />
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
        <MeshReflectorMaterial blur={[300, 80]} resolution={1024} mixBlur={1} mixStrength={6} roughness={0.7} depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color={P.floor} metalness={0.4} mirror={0.35} />
      </mesh>
      <gridHelper args={[40, 40, "#36404F", "#303A48"]} position={[0, 0.003, 0]} />
      {b === "price" ? <PriceSet t={t} /> : null}
      {b === "deal" ? <DealSet t={t} frame={frame} /> : null}
      {b === "loop" ? <LoopSet t={t} /> : null}
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
const PricePanel: React.FC<{ t: number; s: number }> = ({ t, s }) => {
  if (s <= 0.01) return null;
  const x0 = 150;
  const y0 = 930;
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
  const flash = b !== "price" ? clamp01(1 - t / 0.2) : 0;
  const pin = (p: THREE.Vector3, text: string, tone: "cyan" | "amber" | "green" | "red" | "plain", s: number, dx: number, dy: number) => {
    const a = proj(p);
    return <Callout x={a.x} y={a.y} tx={Math.max(250, Math.min(830, a.x + dx))} ty={Math.max(470, Math.min(1230, a.y + dy))} text={text} tone={tone} s={s} />;
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <KitDefs />
      <ChapterTabs y={300} chapters={["PRICE", "DEAL", "LOOP", "MATH", "BUBBLE"]} active={ORDER.indexOf(b)} />

      {b === "price" ? (
        <>
          <TitleCard y={520} line1="WHY RAM" line2="COSTS 4X" accent={K.amber} s={1 - smooth(ramp(T, 1.4, 1.8))} />
          {pin(v3(0.15, 0.98, 0.06), "DDR5 MEMORY CHIP", "plain", sAt(1.6), -170, -230)}
          <PricePanel t={t} s={sAt(0.2, 0.4)} />
          <Source y={1272} text="SOURCE: TOM'S HARDWARE RAM PRICE INDEX · 2025" s={sAt(1.2)} />
        </>
      ) : null}

      {b === "deal" ? (
        <>
          <BigStat x={540} y={600} value={`${Math.round(40 * smooth(ramp(t, 0.6, 2.4)))}%`} label="OF WORLD DRAM · ANALYST ESTIMATE" color={K.amber} size={170} s={sAt(0.3)} />
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

      <Disclaimer text="ILLUSTRATION · SIMPLIFIED · AI VOICE · SOURCES IN CAPTION" />
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
