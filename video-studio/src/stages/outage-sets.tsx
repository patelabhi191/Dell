/**
 * Episode 007 event sets: one small 3D scene per outage (rendered at the origin, one at a time,
 * with hard cuts between them) plus the 2D pop-ups that spring in over each scene: brand
 * badges, error dialogs, a departures board, stamps. Brands are shown as coloured name badges
 * (no logo artwork); drop official logo files in later if wanted.
 *
 * Every set takes the same timing props:
 *   t  seconds since the set came on screen
 *   f  seconds since the failure moment (negative before it)
 *   g  seconds since a secondary cue (FAA "grounded", Chase "Zelle"); unused elsewhere
 */
import React from "react";
import { spring } from "remotion";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { K, MONO } from "../kit";
import { BODY, DISPLAY } from "../theme";

const FPS = 30;
const P = { slate: "#243042", slate2: "#2E3C52", light: "#D8DEE8", cyan: K.cyan, red: K.red, amber: K.amber, green: K.green };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type V = [number, number, number];

export type SetTiming = { t: number; f: number; g: number; frame: number; montage?: boolean };
export type Shot = { x: number; z: number; zoom: number; az: number; y?: number };

/** Camera start/end per set (orthographic iso). y < 0 lifts the subject above frame centre. */
export const SET_SHOTS: Record<string, [Shot, Shot]> = {
  microsoft: [
    { x: 0.2, z: -0.2, zoom: 165, az: 30, y: 0.15 },
    { x: 0.2, z: -0.2, zoom: 190, az: 46, y: 0.15 },
  ],
  faa: [
    { x: 0.6, z: 0, zoom: 120, az: 50, y: -0.45 },
    { x: -0.4, z: 0, zoom: 140, az: 36, y: -0.35 },
  ],
  banks: [
    { x: 0, z: 0, zoom: 135, az: 40, y: -0.15 },
    { x: 0.3, z: 0, zoom: 155, az: 54, y: -0.15 },
  ],
  united: [
    { x: 0, z: 0, zoom: 140, az: 56, y: -0.2 },
    { x: 0, z: 0, zoom: 165, az: 40, y: -0.2 },
  ],
  nsa: [
    { x: 0, z: 0, zoom: 130, az: 34, y: 0.15 },
    { x: 0, z: 0, zoom: 150, az: 50, y: 0.15 },
  ],
  apple: [
    { x: 0, z: 0, zoom: 165, az: 44, y: 0.55 },
    { x: 0, z: 0, zoom: 190, az: 34, y: 0.55 },
  ],
  sony: [
    { x: 0, z: 0, zoom: 145, az: 50, y: -0.05 },
    { x: 0, z: 0, zoom: 170, az: 38, y: -0.05 },
  ],
};

// ---------------------------------------------------------------- shared 3D bits
const glow = (color: string, intensity: number, opacity = 1) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
);
const Box: React.FC<{ p: V; s: V; c?: string; rot?: V; light?: boolean; children?: React.ReactNode }> = ({ p, s, c, rot = [0, 0, 0], light, children }) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow>
    <boxGeometry args={s} />
    {children ?? <meshStandardMaterial color={c ?? (light ? P.light : P.slate)} roughness={light ? 0.5 : 0.72} metalness={0.15} />}
  </mesh>
);
const Pad: React.FC<{ r?: number; color: string }> = ({ r = 3.4, color }) => (
  <group>
    <mesh position={[0, 0.04, 0]} receiveShadow>
      <cylinderGeometry args={[r, r, 0.08, 64]} />
      <meshStandardMaterial color="#182231" roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - 0.06, r, 96]} />
      {glow(color, 2)}
    </mesh>
  </group>
);

/** Airliner, nose along +Z. */
export const Jet: React.FC<{ s?: number; beacon?: string }> = ({ s = 1, beacon }) => (
  <group scale={s}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
      <capsuleGeometry args={[0.05, 0.4, 4, 10]} />
      <meshStandardMaterial color={P.light} roughness={0.45} />
    </mesh>
    <Box p={[0, 0, 0.02]} s={[0.56, 0.018, 0.11]} light />
    <Box p={[0, 0.06, -0.22]} s={[0.018, 0.13, 0.09]} light />
    <Box p={[0, 0.005, -0.22]} s={[0.2, 0.014, 0.06]} light />
    {beacon ? (
      <mesh position={[0, 0.07, 0]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        {glow(beacon, 8)}
      </mesh>
    ) : null}
  </group>
);

const Envelope: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <Box p={[0, 0, 0]} s={[0.32, 0.02, 0.22]} light />
    <Line points={[[-0.15, 0.012, -0.1], [0, 0.012, 0.02], [0.15, 0.012, -0.1]]} color={color} lineWidth={2} />
  </group>
);

// ---------------------------------------------------------------- sets
const MicrosoftSet: React.FC<SetTiming> = ({ t, f, frame }) => {
  const down = f >= 0;
  return (
    <group>
      <Pad color={down ? P.red : P.cyan} />
      {/* desk + monitor */}
      <Box p={[0, 0.55, 0.2]} s={[2.6, 0.08, 1.2]} light />
      {[-1.15, 1.15].map((x) => (
        <Box key={x} p={[x, 0.3, 0.2]} s={[0.08, 0.5, 1.0]} />
      ))}
      <Box p={[0, 0.85, -0.15]} s={[0.12, 0.5, 0.12]} />
      <Box p={[0, 1.55, -0.2]} s={[1.9, 1.1, 0.07]} />
      <mesh position={[0, 1.55, -0.16]}>
        <planeGeometry args={[1.78, 0.98]} />
        {down ? <meshStandardMaterial color="#1A0E14" emissive={P.red} emissiveIntensity={0.25 + 0.15 * Math.abs(Math.sin(frame * 0.3))} toneMapped={false} /> : glow("#9FE3FF", 0.9)}
      </mesh>
      {/* inbox rows on the screen */}
      {Array.from({ length: 5 }, (_, k) => (
        <mesh key={k} position={[0.15, 1.9 - k * 0.16, -0.155]}>
          <planeGeometry args={[1.2, 0.07]} />
          <meshStandardMaterial color={down ? "#3A1A22" : "#E8F7FF"} emissive={down ? "#000" : "#E8F7FF"} emissiveIntensity={down ? 0 : 0.8} toneMapped={false} />
        </mesh>
      ))}
      <Box p={[0, 0.61, 0.45]} s={[1.0, 0.03, 0.35]} c="#1C2534" />
      {/* server rack */}
      <Box p={[2.1, 0.95, -1.4]} s={[0.8, 1.9, 0.8]} />
      {Array.from({ length: 6 }, (_, k) => (
        <mesh key={k} position={[2.1, 0.35 + k * 0.28, -0.995]}>
          <boxGeometry args={[0.55, 0.04, 0.01]} />
          {glow(down ? (Math.sin(frame * 0.7 + k) > 0 ? P.red : "#5A1A22") : P.cyan, 2.5)}
        </mesh>
      ))}
      {/* mail flying from the screen to the server; frozen and falling once it fails */}
      {Array.from({ length: 7 }, (_, k) => {
        const u0 = (t * 0.45 + k / 7) % 1;
        const uStop = ((Math.max(0, t - Math.max(0, f)) * 0.45 + k / 7) % 1);
        const u = down ? uStop : u0;
        const a = v3(0.5, 1.6, 0);
        const b = v3(2.1, 1.9, -1.4);
        const p = a.clone().lerp(b, u);
        p.y += Math.sin(u * Math.PI) * 0.9;
        const fall = down ? Math.min(p.y - 0.2, 1.6 * f * f) : 0;
        return (
          <group key={k} position={[p.x, p.y - fall, p.z]} rotation={[0.3, -0.6 + (down ? f * 2 + k : 0), down ? f * 1.5 : 0]}>
            <Envelope color={down ? P.red : P.cyan} />
          </group>
        );
      })}
    </group>
  );
};

const FAA_RUNWAY_Z = 0.9;
const FaaSet: React.FC<SetTiming> = ({ t, f, frame, montage }) => {
  const stop = f >= 0;
  const blink = Math.sin(frame * 0.5) > 0;
  return (
    <group>
      <Pad r={4.4} color={stop ? P.red : P.cyan} />
      {/* runway */}
      <Box p={[0, 0.1, FAA_RUNWAY_Z]} s={[7.2, 0.02, 0.8]} c="#1A2130" />
      {Array.from({ length: 12 }, (_, k) => (
        <mesh key={k} position={[-3.3 + k * 0.6, 0.115, FAA_RUNWAY_Z]}>
          <boxGeometry args={[0.28, 0.005, 0.05]} />
          {glow("#E8F1FF", 1.4)}
        </mesh>
      ))}
      {Array.from({ length: 14 }, (_, k) =>
        [-0.42, 0.42].map((dz) => (
          <mesh key={`${k}${dz}`} position={[-3.5 + k * 0.54, 0.13, FAA_RUNWAY_Z + dz]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            {glow(stop && k < 2 ? P.red : P.cyan, 4)}
          </mesh>
        )),
      )}
      {/* tower */}
      <mesh position={[-3.0, 1.0, -0.5]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1.8, 12]} />
        <meshStandardMaterial color={P.slate} roughness={0.7} />
      </mesh>
      <mesh position={[-3.0, 2.05, -0.5]} castShadow>
        <cylinderGeometry args={[0.42, 0.32, 0.36, 8]} />
        <meshStandardMaterial color={P.slate2} roughness={0.7} />
      </mesh>
      <mesh position={[-3.0, 2.05, -0.5]}>
        <cylinderGeometry args={[0.425, 0.33, 0.16, 8, 1, true]} />
        {glow(stop ? P.red : P.cyan, 2.4)}
      </mesh>
      {/* router with the flood */}
      <group position={[-1.5, 0.08, -0.85]}>
        <Box p={[0, 0.09, 0]} s={[0.46, 0.18, 0.32]} />
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} position={[-0.16 + k * 0.065, 0.12, 0.162]}>
            <boxGeometry args={[0.03, 0.025, 0.005]} />
            {glow(stop ? (Math.sin(frame * 1.3 + k) > 0 ? P.red : P.amber) : P.green, 5)}
          </mesh>
        ))}
        {stop && f < 5
          ? Array.from({ length: 26 }, (_, k) => {
              const a = (k / 26) * Math.PI * 2;
              const u = (f * 1.3 + k * 0.137) % 1;
              return (
                <mesh key={k} position={[Math.cos(a) * u * 2.2, 0.15 + Math.sin(u * Math.PI) * 0.8, Math.sin(a) * u * 2.2]}>
                  <boxGeometry args={[0.06, 0.06, 0.06]} />
                  {glow(P.red, 5, 1 - u * 0.6)}
                </mesh>
              );
            })
          : null}
      </group>
      {/* departures held on the taxiway (red beacons once stopped) */}
      {[0, 1, 2, 3].map((k) => (
        <group key={k} position={[0.4 + k * 0.85, 0.16, -0.35]} rotation={[0, -Math.PI / 2, 0]}>
          <Jet s={1.6} beacon={stop && blink ? P.red : undefined} />
        </group>
      ))}
      {/* arrivals keep landing */}
      {[0, 1, 2].map((k) => {
        const start = montage ? -0.8 - k * 0.6 : 0.2 + k * 1.6;
        const u = clamp01((t - start) / 2.6);
        if (t < start) return null;
        const x = 6 - 8.8 * u;
        const y = 0.17 + Math.max(0, 2.6 * (1 - u / 0.6));
        const xr = u > 0.6 ? 6 - 8.8 * 0.6 - (u - 0.6) * 4 : x;
        return (
          <group key={`a${k}`} position={[xr, y, FAA_RUNWAY_Z]} rotation={[u < 0.6 ? 0.12 : 0, -Math.PI / 2, 0]}>
            <Jet s={1.8} beacon={P.green} />
          </group>
        );
      })}
    </group>
  );
};

const MONEY_A = [
  new THREE.QuadraticBezierCurve3(v3(-2.3, 1.2, 1.0), v3(-0.6, 2.4, 0.6), v3(1.4, 1.0, -0.4)),
  new THREE.QuadraticBezierCurve3(v3(-2.0, 1.2, -1.3), v3(-0.4, 2.2, -1.1), v3(1.4, 1.0, -0.6)),
];
const Phone: React.FC<{ p: V; color: string; rot?: number }> = ({ p, color, rot = 0 }) => (
  <group position={p} rotation={[0, rot, 0]}>
    <Box p={[0, 0.65, 0]} s={[0.55, 1.1, 0.06]} c="#151C28" />
    <mesh position={[0, 0.65, 0.032]}>
      <planeGeometry args={[0.47, 0.98]} />
      {glow(color, 0.9)}
    </mesh>
  </group>
);
const BanksSet: React.FC<SetTiming> = ({ t, f, g }) => {
  const chaseDown = f >= 0;
  const stuck = g >= 0;
  const wall = smooth(ramp(g, 0, 0.3));
  return (
    <group>
      <Pad r={3.8} color={chaseDown ? P.red : P.cyan} />
      {/* Chase bank */}
      <group position={[1.9, 0.08, -0.5]} scale={1.9}>
        <Box p={[0, 0.06, 0]} s={[1.0, 0.1, 0.8]} />
        {[-0.33, -0.11, 0.11, 0.33].map((x) => (
          <mesh key={x} position={[x, 0.38, 0.3]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.55, 10]} />
            <meshStandardMaterial color={P.light} roughness={0.5} />
          </mesh>
        ))}
        <Box p={[0, 0.38, -0.05]} s={[0.9, 0.55, 0.5]} />
        <Box p={[0, 0.7, 0]} s={[1.04, 0.08, 0.84]} light />
        <mesh position={[0, 0.83, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 1.0, 3]} />
          <meshStandardMaterial color={P.light} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.74, 0.425]}>
          <boxGeometry args={[0.8, 0.03, 0.01]} />
          {glow(chaseDown ? P.red : P.cyan, 3)}
        </mesh>
      </group>
      <Phone p={[-2.4, 0.08, 1.0]} color={stuck ? "#5A2A1A" : "#7FE0B0"} rot={0.4} />
      <Phone p={[-2.1, 0.08, -1.3]} color={stuck ? "#5A2A1A" : "#7FE0B0"} rot={0.7} />
      {/* money in flight; once stuck it hits a red wall and drops */}
      {MONEY_A.map((c, k) => (
        <group key={k}>
          <Line points={c.getPoints(30)} color={stuck ? P.amber : P.green} lineWidth={1.6} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.7} />
          {Array.from({ length: 6 }, (_, j) => {
            const u = stuck ? Math.min(0.52, ((t * 0.5 + j / 6 + k * 0.3) % 1)) : (t * 0.5 + j / 6 + k * 0.3) % 1;
            const p = c.getPoint(u);
            const blocked = stuck && u >= 0.5;
            const drop = blocked ? Math.min(p.y - 0.12 - j * 0.03, 2.2 * Math.max(0, g - j * 0.05) ** 2) : 0;
            const coin = j % 2 === 1;
            return (
              <group key={j} position={[p.x - (blocked ? 0.1 : 0), p.y - drop, p.z]} rotation={[0.4, j, blocked ? g * 3 + j : 0]}>
                {coin ? (
                  <mesh castShadow>
                    <cylinderGeometry args={[0.1, 0.1, 0.03, 20]} />
                    <meshStandardMaterial color="#E9B949" metalness={0.8} roughness={0.3} emissive="#7A5A10" emissiveIntensity={0.4} />
                  </mesh>
                ) : (
                  <mesh castShadow>
                    <boxGeometry args={[0.3, 0.015, 0.15]} />
                    <meshStandardMaterial color="#5FCB8A" roughness={0.6} emissive="#1E6B3E" emissiveIntensity={0.5} />
                  </mesh>
                )}
              </group>
            );
          })}
          {wall > 0 ? (
            <group position={c.getPoint(0.55)} rotation={[0, 0.5, 0]} scale={wall}>
              <mesh>
                <planeGeometry args={[0.9, 0.9]} />
                <meshStandardMaterial color={P.red} emissive={P.red} emissiveIntensity={0.6} transparent opacity={0.35} side={THREE.DoubleSide} toneMapped={false} />
              </mesh>
              {[0.78, -0.78].map((r) => (
                <mesh key={r} rotation={[0, 0, r]}>
                  <boxGeometry args={[0.9, 0.06, 0.02]} />
                  {glow(P.red, 4)}
                </mesh>
              ))}
            </group>
          ) : null}
        </group>
      ))}
    </group>
  );
};

const UnitedSet: React.FC<SetTiming> = ({ t, f, frame }) => {
  const down = f >= 0;
  return (
    <group>
      <Pad r={3.8} color={down ? P.red : P.cyan} />
      <Box p={[-1.6, 0.5, -1.4]} s={[2.2, 0.9, 1.0]} />
      <mesh position={[-1.6, 0.85, -0.89]}>
        <boxGeometry args={[1.9, 0.14, 0.01]} />
        {glow(down ? P.red : P.cyan, 2)}
      </mesh>
      <Box p={[-0.4, 0.8, -0.6]} s={[0.24, 0.2, 1.2]} rot={[0, 0.7, 0]} />
      <group position={[0.5, 0.42, 0.4]} rotation={[0, -0.8, 0]}>
        <Jet s={4.2} beacon={down && Math.sin(frame * 0.5) > 0 ? P.red : undefined} />
      </group>
      {/* baggage belt into the hold; stops when the weight is missing */}
      <group position={[1.5, 0.1, 1.3]} rotation={[0, -0.8, 0]}>
        <Box p={[0, 0.3, 0]} s={[0.35, 0.06, 1.6]} rot={[0.35, 0, 0]} c="#1C2534" />
        {Array.from({ length: 5 }, (_, k) => {
          // The belt freezes at the moment the weight goes missing.
          const tt = down ? t - f : t;
          const u = (k / 5 + tt * 0.35) % 1;
          const z = 0.75 - u * 1.5;
          return <Box key={k} p={[0, 0.42 + (0.75 - z) * 0.36 * 0.5, z]} s={[0.22, 0.15, 0.17]} c={["#C7884A", "#5B6B8C", "#8C5B5B", "#4E7A63", "#B8A25A"][k]} />;
        })}
      </group>
      {/* load-sheet screen on a pole */}
      <group position={[-2.3, 0.08, 1.1]}>
        <Box p={[0, 0.6, 0]} s={[0.06, 1.2, 0.06]} />
        <Box p={[0, 1.35, 0]} s={[0.9, 0.55, 0.06]} rot={[0, 0.6, 0]} />
        <mesh position={[Math.sin(0.6) * 0.035, 1.35, Math.cos(0.6) * 0.035]} rotation={[0, 0.6, 0]}>
          <planeGeometry args={[0.8, 0.45]} />
          {glow(down ? (Math.sin(frame * 0.4) > 0 ? P.amber : "#3A2A10") : P.cyan, 1.4)}
        </mesh>
      </group>
    </group>
  );
};

const NSA_NODES = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * Math.PI * 2;
  return v3(Math.cos(a) * 2.2, 2.0 + Math.sin(a * 3) * 0.25, Math.sin(a) * 2.2);
});
const NSA_LINKS = NSA_NODES.flatMap((_, k) => [
  [k, (k + 1) % 12],
  [k, (k + 4) % 12],
]);
const NsaSet: React.FC<SetTiming> = ({ f, frame }) => {
  const down = f >= 0;
  return (
    <group>
      <Pad r={3.6} color={down ? P.red : P.cyan} />
      <Box p={[0, 0.4, 0]} s={[1.8, 0.65, 1.2]} />
      <mesh position={[0, 0.74, 0.61]}>
        <boxGeometry args={[1.5, 0.06, 0.01]} />
        {glow(down ? P.red : P.cyan, 2)}
      </mesh>
      {[
        [1.4, 0.8],
        [-1.5, 0.9],
      ].map(([x, z], k) => (
        <group key={k} position={[x, 0.08, z]}>
          <Box p={[0, 0.35, 0]} s={[0.06, 0.7, 0.06]} />
          <mesh position={[0, 0.78, 0]} rotation={[-0.9, frame * 0.01 + k, 0]} castShadow>
            <sphereGeometry args={[0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            <meshStandardMaterial color={P.light} roughness={0.45} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 20 }, (_, k) => {
        const a = (k / 20) * Math.PI * 2;
        return <Box key={k} p={[Math.cos(a) * 2.9, 0.3, Math.sin(a) * 2.9]} s={[0.04, 0.44, 0.04]} c={P.slate2} />;
      })}
      {/* classified network ring above the building; links drop out one by one */}
      {NSA_LINKS.map(([a, b], k) => {
        const off = down && f > (k / NSA_LINKS.length) * 1.4;
        return <Line key={k} points={[NSA_NODES[a].toArray() as V, NSA_NODES[b].toArray() as V]} color={off ? P.red : P.cyan} lineWidth={1.6} transparent opacity={off ? 0.15 : 0.75} />;
      })}
      {NSA_NODES.map((p, k) => (
        <mesh key={k} position={p}>
          <sphereGeometry args={[0.09, 12, 12]} />
          {glow(down && f > (k / 12) * 1.4 ? P.red : P.cyan, 4)}
        </mesh>
      ))}
      {/* padlock */}
      <group position={[0, 2.0, 0]} rotation={[0, frame * 0.02, 0]}>
        <Box p={[0, -0.12, 0]} s={[0.5, 0.4, 0.16]}>
          {glow(down ? P.red : P.cyan, 1.6)}
        </Box>
        <mesh position={[0, 0.12, 0]}>
          <torusGeometry args={[0.17, 0.04, 10, 30, Math.PI]} />
          <meshStandardMaterial color={P.light} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

/** App tiles on the phone (generic glyphs, not Apple's icons). */
export const APPLE_TILES: { label: string; color: string; p: V }[] = [
  { label: "ICLOUD", color: "#4AA8FF", p: [-0.42, 1.95, 0.075] },
  { label: "APPLE PAY", color: "#2A2F3A", p: [0, 1.95, 0.075] },
  { label: "APP STORE", color: "#2F7CF6", p: [0.42, 1.95, 0.075] },
];
const AppleSet: React.FC<SetTiming> = ({ f, frame }) => {
  const down = f >= 0;
  return (
    <group>
      <Pad r={3.2} color={down ? P.red : P.cyan} />
      <group position={[0, 0.08, 0]}>
        <Box p={[0, 1.6, 0]} s={[1.5, 3.0, 0.12]} c="#141A24" />
        <mesh position={[0, 1.6, 0.062]}>
          <planeGeometry args={[1.36, 2.84]} />
          <meshStandardMaterial color="#0E1830" emissive="#1C3A7A" emissiveIntensity={down ? 0.25 : 0.7} toneMapped={false} />
        </mesh>
        {APPLE_TILES.map((tile, k) => {
          const x = down && f > 0.3 + k * 0.35;
          return (
            <group key={k} position={tile.p}>
              <Box p={[0, 0, 0]} s={[0.3, 0.3, 0.04]} c={tile.color}>
                <meshStandardMaterial color={x ? "#5A1E26" : tile.color} emissive={x ? P.red : tile.color} emissiveIntensity={x ? 0.5 : 0.35} toneMapped={false} />
              </Box>
              {x
                ? [0.78, -0.78].map((r) => (
                    <mesh key={r} position={[0, 0, 0.03]} rotation={[0, 0, r]}>
                      <boxGeometry args={[0.32, 0.04, 0.01]} />
                      {glow(P.red, 5)}
                    </mesh>
                  ))
                : null}
            </group>
          );
        })}
        {/* more (generic) apps below */}
        {Array.from({ length: 9 }, (_, k) => (
          <Box key={`g${k}`} p={[-0.42 + (k % 3) * 0.42, 1.5 - Math.floor(k / 3) * 0.42, 0.075]} s={[0.3, 0.3, 0.03]} c={["#3E8E6A", "#C9783E", "#7C5CC4", "#3A6FB0", "#B04A5A", "#4A9AB0", "#8A8F3A", "#5A6A8A", "#B08A3A"][k]} />
        ))}
      </group>
      {/* store card terminal */}
      <group position={[1.6, 0.08, 0.9]}>
        <Box p={[0, 0.45, 0]} s={[0.5, 0.9, 0.4]} />
        <Box p={[0, 0.98, 0.05]} s={[0.32, 0.12, 0.42]} c="#1C2534" />
        <mesh position={[0, 1.045, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.24, 0.34]} />
          {glow(down ? (Math.sin(frame * 0.5) > 0 ? P.red : "#3A1018") : P.green, 2)}
        </mesh>
      </group>
    </group>
  );
};

const SonySet: React.FC<SetTiming> = ({ f, frame }) => {
  const down = f >= 0;
  return (
    <group>
      <Pad r={3.8} color={down ? P.red : P.cyan} />
      {/* TV */}
      <Box p={[0, 0.35, -0.6]} s={[1.2, 0.06, 0.5]} />
      <Box p={[0, 0.6, -0.6]} s={[0.12, 0.5, 0.12]} />
      <Box p={[0, 1.7, -0.6]} s={[3.4, 1.9, 0.1]} c="#10151E" />
      <mesh position={[0, 1.7, -0.545]}>
        <planeGeometry args={[3.24, 1.76]} />
        <meshStandardMaterial color="#071021" emissive={down ? "#26070C" : "#0F3A8A"} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* loading ring on screen once it can't connect */}
      {down ? (
        <mesh position={[0, 1.85, -0.53]} rotation={[0, 0, -frame * 0.25]}>
          <torusGeometry args={[0.3, 0.035, 8, 40, Math.PI * 1.4]} />
          {glow(P.red, 3)}
        </mesh>
      ) : (
        Array.from({ length: 5 }, (_, k) => (
          <mesh key={k} position={[-1.1 + k * 0.55, 1.5, -0.535]}>
            <planeGeometry args={[0.45, 0.6]} />
            {glow(["#4A7BE0", "#6A4AE0", "#E04A7B", "#4AE0B0", "#E0B04A"][k], 0.8)}
          </mesh>
        ))
      )}
      {/* console */}
      <Box p={[1.95, 0.55, -0.4]} s={[0.35, 0.95, 0.75]} light />
      <Box p={[1.95, 0.55, -0.4]} s={[0.12, 0.97, 0.77]} c="#1A1F2A" />
      <mesh position={[2.13, 0.85, -0.02]}>
        <boxGeometry args={[0.01, 0.2, 0.02]} />
        {glow(down ? P.red : P.cyan, 4)}
      </mesh>
      {/* controller */}
      <group position={[0.3, 0.16, 1.0]} rotation={[0, 0.3, 0]}>
        <Box p={[0, 0, 0]} s={[0.6, 0.1, 0.28]} light />
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, 0, 0.1]} rotation={[0.4, 0, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.15, 4, 8]} />
            <meshStandardMaterial color={P.light} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.06, 0.02]}>
          <boxGeometry args={[0.18, 0.01, 0.06]} />
          {glow(down ? P.red : P.cyan, 3)}
        </mesh>
      </group>
      {/* players losing the connection */}
      {Array.from({ length: 6 }, (_, k) => {
        const a = Math.PI * 0.15 + (k / 5) * Math.PI * 0.7;
        const p = v3(Math.cos(a) * 3.0, 0.3, Math.sin(a) * 2.6);
        const ok = !down || f < k * 0.25;
        return (
          <group key={k}>
            <mesh position={p}>
              <sphereGeometry args={[0.1, 12, 12]} />
              {glow(ok ? P.cyan : P.red, 3)}
            </mesh>
            <Line points={[p.toArray() as V, [1.95, 0.8, -0.4]]} color={ok ? P.cyan : P.red} lineWidth={1.2} dashed={!ok} dashSize={0.08} gapSize={0.08} transparent opacity={ok ? 0.6 : 0.3} />
          </group>
        );
      })}
    </group>
  );
};

export const EventSet: React.FC<SetTiming & { id: string }> = ({ id, ...tm }) => {
  if (id === "microsoft") return <MicrosoftSet {...tm} />;
  if (id === "faa") return <FaaSet {...tm} />;
  if (id === "banks") return <BanksSet {...tm} />;
  if (id === "united") return <UnitedSet {...tm} />;
  if (id === "nsa") return <NsaSet {...tm} />;
  if (id === "apple") return <AppleSet {...tm} />;
  if (id === "sony") return <SonySet {...tm} />;
  return null;
};

// ---------------------------------------------------------------- 2D pop-ups
const pop = (t: number, delay = 0) => (t < delay ? 0 : spring({ frame: (t - delay) * FPS, fps: FPS, config: { damping: 11, mass: 0.6 } }));

export const BRANDS: Record<string, { name: string; color: string; ink: string }> = {
  microsoft: { name: "Microsoft 365", color: "#0F6CBD", ink: "#FFFFFF" },
  faa: { name: "FAA", color: "#1B3A6B", ink: "#FFFFFF" },
  banks: { name: "CHASE", color: "#117ACA", ink: "#FFFFFF" },
  united: { name: "UNITED", color: "#0B4EA2", ink: "#FFFFFF" },
  nsa: { name: "NSA", color: "#26334D", ink: "#FFFFFF" },
  apple: { name: "Apple", color: "#F2F2F7", ink: "#111111" },
  sony: { name: "PlayStation", color: "#0070D1", ink: "#FFFFFF" },
};

/** Brand name badge with an OFFLINE tag once it fails. */
const Badge: React.FC<{ id: string; y: number; s: number; down: boolean }> = ({ id, y, s, down }) => {
  if (s <= 0.01) return null;
  const b = BRANDS[id];
  const w = b.name.length * 34 + 90;
  return (
    <g transform={`translate(540 ${y}) scale(${s * 0.82})`}>
      <rect x={-w / 2} y={-46} width={w} height={92} rx={22} fill={b.color} stroke="rgba(255,255,255,0.5)" strokeWidth={3} />
      <text x={0} y={18} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={54} fill={b.ink}>
        {b.name}
      </text>
      {down ? (
        <g transform={`translate(${w / 2 - 10} -46) rotate(8)`}>
          <rect x={-70} y={-24} width={150} height={44} rx={8} fill={K.red} />
          <text x={5} y={7} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill="#fff">
            OFFLINE
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** App-style error dialog. */
const Dialog: React.FC<{ x: number; y: number; w?: number; title: string; body: string; s: number; tone?: string; icon?: "x" | "!" | "spin"; frame: number }> = ({
  x,
  y,
  w = 640,
  title,
  body,
  s,
  tone = K.red,
  icon = "x",
  frame,
}) => {
  if (s <= 0.01) return null;
  const h = 150;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={clamp01(s * 1.4)}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={18} fill="#F5F7FB" />
      <rect x={-w / 2} y={-h / 2} width={w} height={36} rx={18} fill="#E1E5EE" />
      <rect x={-w / 2} y={-h / 2 + 18} width={w} height={18} fill="#E1E5EE" />
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c, k) => (
        <circle key={c} cx={-w / 2 + 26 + k * 22} cy={-h / 2 + 18} r={7} fill={c} />
      ))}
      <text x={-w / 2 + 100} y={-h / 2 + 25} fontFamily={BODY} fontWeight={800} fontSize={20} fill="#4A5163">
        {title}
      </text>
      <g transform={`translate(${-w / 2 + 62} ${22})`}>
        {icon === "spin" ? (
          <circle r={22} fill="none" stroke={tone} strokeWidth={6} strokeDasharray="90 60" transform={`rotate(${frame * 12})`} />
        ) : (
          <>
            <circle r={26} fill={tone} />
            <text y={11} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={34} fill="#fff">
              {icon === "x" ? "✕" : "!"}
            </text>
          </>
        )}
      </g>
      <text x={-w / 2 + 110} y={32} fontFamily={BODY} fontWeight={900} fontSize={30} fill="#111622">
        {body}
      </text>
    </g>
  );
};

const Stamp: React.FC<{ x: number; y: number; text: string; s: number; color?: string; size?: number }> = ({ x, y, text, s, color = K.red, size = 64 }) => {
  if (s <= 0.01) return null;
  const w = text.length * size * 0.6 + 60;
  const k = 1 + (1 - Math.min(1, s)) * 1.2;
  return (
    <g transform={`translate(${x} ${y}) rotate(-7) scale(${k})`} opacity={clamp01(s)}>
      <rect x={-w / 2} y={-size * 0.8} width={w} height={size * 1.6} rx={12} fill="rgba(10,6,10,0.55)" stroke={color} strokeWidth={8} />
      <text x={0} y={size * 0.33} textAnchor="middle" fontFamily={DISPLAY} fontSize={size} fill={color} letterSpacing={2}>
        {text}
      </text>
    </g>
  );
};

const DEPARTURES = [
  ["1042", "DENVER"],
  ["387", "CHICAGO"],
  ["2215", "ATLANTA"],
  ["918", "DALLAS"],
  ["1560", "LOS ANGELES"],
];
const Board: React.FC<{ y: number; s: number; g: number }> = ({ y, s, g }) => {
  if (s <= 0.01) return null;
  return (
    <g transform={`translate(540 ${y}) scale(${s})`}>
      <rect x={-380} y={-40} width={760} height={360} rx={16} fill="#0A0F18" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
      <text x={-350} y={2} fontFamily={MONO} fontWeight={700} fontSize={28} fill={K.amber} letterSpacing={3}>
        DEPARTURES
      </text>
      {DEPARTURES.map(([fl, city], k) => {
        const flipped = g >= 0.15 + k * 0.22;
        const status = flipped ? (k === 2 ? "CANCELED" : "HOLD") : "ON TIME";
        const col = flipped ? (k === 2 ? K.amber : K.red) : K.green;
        return (
          <g key={fl} transform={`translate(0 ${58 + k * 54})`}>
            <rect x={-360} y={-28} width={720} height={44} rx={6} fill="#121A28" />
            <text x={-340} y={4} fontFamily={MONO} fontWeight={700} fontSize={26} fill={K.white}>
              {fl}
            </text>
            <text x={-210} y={4} fontFamily={MONO} fontWeight={700} fontSize={26} fill={K.white}>
              {city}
            </text>
            <text x={340} y={4} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={26} fill={col}>
              {status}
            </text>
          </g>
        );
      })}
      <text x={0} y={350} textAnchor="middle" fontFamily={MONO} fontSize={16} fill={K.muted}>
        ILLUSTRATIVE FLIGHTS
      </text>
    </g>
  );
};

const Tag: React.FC<{ x: number; y: number; text: string; s: number; color?: string }> = ({ x, y, text, s, color = K.amber }) => {
  if (s <= 0.01) return null;
  const w = text.length * 15.5 + 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-w / 2} y={-24} width={w} height={48} rx={8} fill={K.panel} stroke={color} strokeWidth={2} />
      <text x={0} y={8} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={color} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

/**
 * Pop-ups for one set. In the hook montage only the badge and a DOWN stamp show.
 */
export const EventPopups: React.FC<SetTiming & { id: string }> = ({ id, t, f, g, frame, montage }) => {
  const down = f >= 0;
  const badge = pop(t, 0.02);
  if (montage) {
    return (
      <g>
        <Badge id={id} y={492} s={badge} down={down} />
        <Stamp x={540} y={1170} text="DOWN" s={pop(f, 0.05)} size={84} />
      </g>
    );
  }
  return (
    <g>
      <Badge id={id} y={492} s={badge} down={down} />
      {id === "microsoft" ? (
        <>
          <Dialog x={540} y={1110} title="Outlook" body="Can't connect to the server" s={pop(f, 0.2)} frame={frame} />
          <Dialog x={560} y={1235} title="Teams" body="Reconnecting…" icon="spin" tone={K.amber} s={pop(f, 1.1)} frame={frame} />
        </>
      ) : null}
      {id === "faa" ? (
        <>
          <Tag x={540} y={590} text="NEW ROUTER FLOODED THE NETWORK" color={K.red} s={pop(f, 0.1)} />
          <Board y={975} s={pop(f, 0.9) * 0.8} g={g} />
          <Stamp x={540} y={1268} text="GROUND STOP" s={pop(g, 0.9)} size={62} />
        </>
      ) : null}
      {id === "banks" ? (
        <>
          <Tag x={540} y={590} text="SOFTWARE BUG" color={K.amber} s={pop(f, 0.2)} />
          <Dialog x={540} y={1120} title="Zelle" body="Sending $250…" icon="spin" tone={K.green} s={pop(t, 0.6) * (g >= 0 ? 0 : 1)} frame={frame} />
          <Dialog x={540} y={1120} title="Zelle" body="Payment didn't go through" s={pop(g, 0.05)} frame={frame} />
          <Stamp x={540} y={1262} text="PAYMENTS STUCK" s={pop(g, 0.8)} size={54} />
          <Tag x={880} y={1040} text="SIMPLIFIED EXAMPLE" color={K.muted} s={pop(g, 1.0) * 0.8} />
        </>
      ) : null}
      {id === "united" ? (
        <>
          <Dialog x={540} y={1120} title="Load sheet" body="Final weight: unavailable" icon="!" tone={K.amber} s={pop(f, 0.2)} frame={frame} />
          <Stamp x={540} y={1262} text="DEPARTURES WAIT" s={pop(f, 1.4)} size={58} color={K.amber} />
        </>
      ) : null}
      {id === "nsa" ? (
        <>
          <Dialog x={540} y={1120} title="NSANet" body="Classified network offline" s={pop(f, 0.6)} frame={frame} />
          <Tag x={540} y={1262} text="CAUSE: ROUTINE MAINTENANCE" color={K.amber} s={pop(f, 1.6)} />
        </>
      ) : null}
      {id === "apple" ? (
        <>
          {APPLE_TILES.map((tile, k) => (
            <Tag key={tile.label} x={[300, 540, 780][k]} y={1100} text={`${tile.label} ✕`} color={K.red} s={pop(f, 0.35 + k * 0.35)} />
          ))}
          <Dialog x={540} y={1232} title="Apple Account" body="Can't sign in. Try again later." s={pop(f, 1.4)} frame={frame} />
        </>
      ) : null}
      {id === "sony" ? (
        <>
          <Dialog x={540} y={1120} title="PlayStation Network" body="Can't connect to the server" s={pop(f, 0.3)} frame={frame} />
          <Tag x={540} y={1262} text="HOURS BEFORE GTA VI" color={K.amber} s={pop(f, 1.2)} />
        </>
      ) : null}
    </g>
  );
};
