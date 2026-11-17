import React, { useContext, useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Line, MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { BeatsContext } from "../beats";
import { BigStat, Callout, Checklist, Disclaimer, K, KitDefs, MONO, StatusBar, TitleCard, Waveform } from "../kit";
import { WarmUp, logRenderer } from "../three/common";
import { AIRPORTS, CENTERS, FAIL_AT, FLIGHTS, LINKS, US } from "./groundstop";

/**
 * Episode 006: the ground-stop story as one real 3D world (rendered with @remotion/three on the
 * GPU). A glowing night map of the US sits on a glossy floor: airports with parked planes,
 * flights arcing overhead, the 22 control centers as towers joined by the network, and "the
 * box" (the router) as a hero prop the camera keeps returning to. The HUD, pinned labels and
 * data graphics are the SVG kit drawn on top, pinned to 3D points by projecting them through
 * the same camera.
 *
 * Same beats and cues as episodes 004/005. Everything is a pure function of the frame.
 */

const W = 1080;
const H = 1920;
const FOV = 50;
const C = { cyan: K.cyan, red: K.red, amber: K.amber, green: K.green, white: K.white, bg: "#05080F" };

// ---------------------------------------------------------------- map space
// The 2D map (x 85-905, y 215-670) becomes the ground plane: x -> X, y -> Z, 40 px per unit.
const S = 1 / 40;
const mp = (x: number, y: number): [number, number] => [(x - 495) * S, (y - 440) * S];
const MAP_TOP = 0.12; // height of the land slab

const insideUS = (x: number, y: number) => {
  let hit = false;
  for (let i = 0, j = US.length - 1; i < US.length; j = i++) {
    const [xi, yi] = US[i];
    const [xj, yj] = US[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

const APT = AIRPORTS.map(([, x, y]) => mp(x, y));
const CTR = CENTERS.map(([x, y]) => mp(x, y));
// The router sits in open ground between centers, so close-ups have no tower behind it.
const [RX, RZ] = mp(535, 420);
const ROUTER: [number, number, number] = [RX, MAP_TOP, RZ];
const RV = new THREE.Vector3(ROUTER[0], ROUTER[1], ROUTER[2]);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t)).getHexString()}`;

// ---------------------------------------------------------------- timing
const ORDER = ["hook", "grounded", "older", "flights", "stop", "centers", "talk", "lost", "cyber", "router", "flood", "warned", "money", "question"] as const;
type BeatName = (typeof ORDER)[number];
type Beats = Record<string, number>;
const FPS = 30;

/** Seconds since a beat or cue started (negative before; large negative if it doesn't exist). */
const since = (beats: Beats, frame: number, name: string) => (beats[name] === undefined ? -999 : (frame - beats[name]) / FPS);
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

const currentBeat = (beats: Beats, frame: number) => {
  let idx = 0;
  ORDER.forEach((b, i) => {
    if (beats[b] !== undefined && frame >= beats[b]) idx = i;
  });
  return idx;
};

// ---------------------------------------------------------------- camera
type Pose = { p: THREE.Vector3; t: THREE.Vector3 };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const R = (dx: number, dy: number, dz: number) => v(RV.x + dx, RV.y + dy, RV.z + dz);
const DEN = APT[6];
const TALK = mp(410, 470); // where the two cruising planes are shown

/** Start and end pose of each beat; the camera eases between beats and drifts inside one. */
const SHOTS: Record<BeatName, [Pose, Pose]> = {
  hook: [
    { p: R(0.9, 0.55, 1.5), t: R(0, 0.32, 0) },
    { p: R(3.2, 3.6, 7.5), t: R(-0.5, 0.2, 0) },
  ],
  grounded: [
    { p: v(-1, 13, 14), t: v(0, 0, 0.5) },
    { p: v(1.5, 12, 12.5), t: v(0, 0, 0) },
  ],
  older: [
    { p: v(-7.5, 1.6, 3.2), t: v(-1, 0.3, -1) },
    { p: v(-5.5, 1.9, 4.4), t: v(1, 0.3, -1.4) },
  ],
  flights: [
    { p: v(-4, 6.5, 10), t: v(-0.5, 1.4, 0) },
    { p: v(-1, 6, 9), t: v(0.5, 1.4, -0.5) },
  ],
  stop: [
    { p: v(DEN[0] + 2.5, 2.6, DEN[1] + 3.8), t: v(DEN[0], 0.2, DEN[1]) },
    { p: v(DEN[0] + 5, 6, DEN[1] + 9), t: v(DEN[0] + 1.5, 0.2, DEN[1]) },
  ],
  centers: [
    { p: v(3, 12, 13), t: v(0, 0.5, 0) },
    { p: v(-2, 10.5, 11.5), t: v(0, 0.5, 0) },
  ],
  talk: [
    { p: v(TALK[0] + 2.6, 3.3, TALK[1] + 3.6), t: v(TALK[0], 1.9, TALK[1]) },
    { p: v(TALK[0] + 4, 4.4, TALK[1] + 5.5), t: v(TALK[0] - 0.5, 1.4, TALK[1] - 0.5) },
  ],
  lost: [
    { p: v(0, 14, 13), t: v(0, 0.5, -0.3) },
    { p: v(2, 12.5, 11.5), t: v(0, 0.5, -0.3) },
  ],
  cyber: [
    { p: v(-6, 5, 8), t: v(0, 0.6, -0.5) },
    { p: v(-3, 4.6, 9), t: v(0.5, 0.6, -0.5) },
  ],
  router: [
    { p: R(1.7, 1.05, 2.1), t: R(-0.35, 0.22, 0) },
    { p: R(0.2, 1.15, 2.3), t: R(-0.45, 0.2, 0) },
  ],
  flood: [
    { p: R(1.2, 1.4, 2.4), t: R(0, 0.3, 0) },
    { p: R(3, 7, 9.5), t: R(-1, 0, 0.5) },
  ],
  warned: [
    { p: v(0, 17, 12), t: v(0, 0, 0.2) },
    { p: v(-1.5, 15, 11), t: v(0, 0, 0.2) },
  ],
  money: [
    { p: v(-5, 7, 10), t: v(0, 0.8, 0) },
    { p: v(-2, 6.5, 9.5), t: v(0.5, 0.8, 0) },
  ],
  question: [
    { p: R(3, 2.2, 4.2), t: R(0, 0.4, 0) },
    { p: R(-3.4, 2.6, 3.6), t: R(0, 0.4, 0) },
  ],
};

const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({ p: a.p.clone().lerp(b.p, t), t: a.t.clone().lerp(b.t, t) });
const TRANSITION = 0.85; // seconds to ease from one shot to the next

const cameraAt = (beats: Beats, frame: number, total: number): Pose => {
  const i = currentBeat(beats, frame);
  const name = ORDER[i];
  const start = beats[name] ?? 0;
  const within = (f: number, idx: number) => {
    const nm = ORDER[idx];
    const s = beats[nm] ?? 0;
    const nx = ORDER.slice(idx + 1).find((b) => beats[b] !== undefined);
    const e = nx ? beats[nx] : total;
    const u = Easing.inOut(Easing.quad)(clamp01((f - s) / Math.max(1, e - s)));
    return lerpPose(SHOTS[nm][0], SHOTS[nm][1], u);
  };
  const here = within(frame, i);
  const local = (frame - start) / FPS;
  if (i === 0 || local >= TRANSITION) return here;
  // Ease from where the previous shot ended into this one.
  const prev = within(start, i - 1);
  return lerpPose(prev, here, Easing.inOut(Easing.cubic)(local / TRANSITION));
};

// ---------------------------------------------------------------- flights
const flightPoint = (a: number, b: number, u: number) => {
  const [ax, az] = APT[a];
  const [bx, bz] = APT[b];
  const d = Math.hypot(bx - ax, bz - az);
  const y = MAP_TOP + 0.08 + Math.min(2.4, 0.35 + d * 0.16) * Math.sin(Math.PI * u);
  return v(ax + (bx - ax) * u, y, az + (bz - az) * u);
};

type Active = { i: number; a: number; b: number; u: number };
/** Planes in the air at time t (seconds). No new departures after the ground stop. */
const activeFlights = (t: number, stopT: number): Active[] => {
  const out: Active[] = [];
  FLIGHTS.forEach(([a, b], i) => {
    const period = 6.5 + (i % 5) * 0.9;
    const phase = -random(`fph${i}`) * period;
    const [ax, az] = APT[a];
    const [bx, bz] = APT[b];
    const dur = 4.5 + Math.hypot(bx - ax, bz - az) * 0.42;
    for (let k = 0; k < 14; k++) {
      const t0 = phase + k * period;
      if (t0 > stopT) break;
      if (t >= t0 && t <= t0 + dur) out.push({ i, a, b, u: (t - t0) / dur });
    }
  });
  return out;
};

// ---------------------------------------------------------------- static data
const CITY = (() => {
  const pos: number[] = [];
  const col: number[] = [];
  const warm = ["#FFE7A8", "#FFD27A", "#FFF6DD", "#FFB86B"].map((h) => new THREE.Color(h));
  for (let i = 0; pos.length < 900 * 3 && i < 6000; i++) {
    let x: number;
    let y: number;
    if (i % 10 < 6) {
      const a = AIRPORTS[i % AIRPORTS.length];
      const ang = random(`ca${i}`) * Math.PI * 2;
      const d = Math.pow(random(`cd${i}`), 1.6) * 46;
      x = a[1] + Math.cos(ang) * d;
      y = a[2] + Math.sin(ang) * d * 0.8;
    } else {
      x = 85 + random(`cx${i}`) * 820;
      y = 215 + random(`cy${i}`) * 455;
    }
    if (!insideUS(x, y)) continue;
    const [X, Z] = mp(x, y);
    pos.push(X, MAP_TOP + 0.012, Z);
    const c = warm[i % warm.length];
    const k = 0.6 + random(`ck${i}`) * 1.4;
    col.push(c.r * k, c.g * k, c.b * k);
  }
  return { pos: new Float32Array(pos), col: new Float32Array(col) };
})();

const DOTS_2009 = Array.from({ length: 129 }, (_, i) => {
  for (let k = 0; k < 60; k++) {
    const x = 100 + random(`n9x${i}-${k}`) * 800;
    const y = 225 + random(`n9y${i}-${k}`) * 440;
    if (insideUS(x, y)) return { p: mp(x, y), when: 0.2 + random(`n9t${i}`) * 2.4 };
  }
  return { p: mp(500, 400), when: 1 };
});

const linkCurve = (a: [number, number], b: [number, number], lift: number) =>
  new THREE.QuadraticBezierCurve3(
    v(a[0], MAP_TOP + 0.03, a[1]),
    v((a[0] + b[0]) / 2, MAP_TOP + lift, (a[1] + b[1]) / 2),
    v(b[0], MAP_TOP + 0.03, b[1]),
  );
const LINK_CURVES = LINKS.map(([a, b]) => linkCurve(CTR[a] as [number, number], CTR[b] as [number, number], 0.35));
const LINK_POINTS = LINK_CURVES.map((c) => c.getPoints(24));
const FLOOD_CURVES = CTR.map((c) => {
  const [x, z] = c;
  const d = Math.hypot(x - RV.x, z - RV.z);
  return new THREE.QuadraticBezierCurve3(v(RV.x, RV.y + 0.35, RV.z), v((x + RV.x) / 2, MAP_TOP + 0.6 + d * 0.22, (z + RV.z) / 2), v(x, MAP_TOP + 1.2, z));
});
const FLOOD_POINTS = FLOOD_CURVES.map((c) => c.getPoints(28));

const towerFailT = (i: number) => FAIL_AT[i];
/** Seconds since the centers start failing: from just after the "lost" beat begins, so the
 *  towers go red while the voice says "seventeen" (the "started" cue comes too late). */
const sinceFail = (beats: Beats, frame: number) => since(beats, frame, "lost") - 0.35;

// ---------------------------------------------------------------- 3D parts
const glow = (color: string, intensity: number, opacity = 1) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
);

const Land: React.FC = () => {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(US.map(([x, y]) => {
      const [X, Z] = mp(x, y);
      return new THREE.Vector2(X, -Z);
    }));
    return new THREE.ExtrudeGeometry(shape, { depth: MAP_TOP, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2 });
  }, []);
  const outline = useMemo(() => [...US, US[0]].map(([x, y]) => {
    const [X, Z] = mp(x, y);
    return [X, MAP_TOP + 0.035, Z] as [number, number, number];
  }), []);
  // Surface detail: a fine survey grid (one tile per map unit) so close-ups never show a
  // featureless slab. The extrude top face uses map units as UVs, so repeat = 1 per unit.
  const tex = useMemo(() => {
    const n = 256;
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#0E1A33";
    g.fillRect(0, 0, n, n);
    g.strokeStyle = "rgba(46,211,255,0.10)";
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo((k * n) / 4, 0);
      g.lineTo((k * n) / 4, n);
      g.moveTo(0, (k * n) / 4);
      g.lineTo(n, (k * n) / 4);
      g.stroke();
    }
    g.strokeStyle = "rgba(46,211,255,0.32)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, n, n);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(160,200,255,${0.08 + random(`tx${k}`) * 0.15})`;
      g.fillRect(random(`tu${k}`) * n, random(`tv${k}`) * n, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#3A7BFF" emissiveIntensity={0.55} metalness={0.35} roughness={0.75} />
      </mesh>
      <Line points={outline} color={C.cyan} lineWidth={2.5} transparent opacity={0.75} />
    </group>
  );
};

const CityLights: React.FC<{ level: number }> = ({ level }) => (
  <points>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[CITY.pos, 3]} />
      <bufferAttribute attach="attributes-color" args={[CITY.col, 3]} />
    </bufferGeometry>
    <pointsMaterial size={0.07} vertexColors transparent opacity={0.95 * level} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
  </points>
);

/** A small airliner with its nose along +Z. */
const PlaneModel: React.FC<{ color?: string; nav?: boolean }> = ({ color = "#E9EEF8", nav = true }) => (
  <group>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <capsuleGeometry args={[0.035, 0.26, 4, 10]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} emissive={color} emissiveIntensity={0.15} />
    </mesh>
    <mesh position={[0, 0, 0.01]}>
      <boxGeometry args={[0.38, 0.012, 0.075]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.045, -0.15]}>
      <boxGeometry args={[0.012, 0.09, 0.06]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.005, -0.15]}>
      <boxGeometry args={[0.13, 0.01, 0.045]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
    </mesh>
    {nav ? (
      <>
        <mesh position={[-0.19, 0, 0.01]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          {glow(C.red, 6)}
        </mesh>
        <mesh position={[0.19, 0, 0.01]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          {glow(C.green, 6)}
        </mesh>
      </>
    ) : null}
  </group>
);

const orient = (pos: THREE.Vector3, dir: THREE.Vector3) => {
  const m = new THREE.Matrix4().lookAt(pos.clone().add(dir), pos, new THREE.Vector3(0, 1, 0));
  return new THREE.Euler().setFromRotationMatrix(m);
};

const Airports: React.FC<{ tStop: number; frame: number }> = ({ tStop, frame }) => (
  <group>
    {APT.map(([x, z], i) => {
      const stopped = tStop >= 0;
      const pulse = stopped ? 0.6 + 0.4 * Math.abs(Math.sin(frame * 0.12 + i)) : 0;
      const ringColor = stopped ? C.red : C.cyan;
      const ang = random(`apr${i}`) * Math.PI;
      return (
        <group key={i} position={[x, MAP_TOP, z]}>
          <mesh rotation={[0, ang, 0]} position={[0, 0.006, 0]}>
            <boxGeometry args={[0.7, 0.012, 0.07]} />
            <meshStandardMaterial color="#2A3352" roughness={0.6} />
          </mesh>
          <mesh rotation={[0, ang, 0]} position={[0, 0.014, 0]}>
            <boxGeometry args={[0.66, 0.004, 0.008]} />
            {glow("#DDEBFF", 2.5)}
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.36, 0.4 + pulse * 0.06, 48]} />
            {glow(ringColor, stopped ? 3 * pulse + 1 : 1.2, stopped ? 0.95 : 0.55)}
          </mesh>
          {/* Two planes parked by the runway, nose to the runway */}
          {[-0.14, 0.14].map((dx, k) => (
            <group key={k} position={[Math.cos(ang + Math.PI / 2) * 0.2 + dx * Math.cos(ang), 0.05, -Math.sin(ang + Math.PI / 2) * 0.2 - dx * Math.sin(ang)]} rotation={[0, ang + Math.PI, 0]} scale={0.75}>
              <PlaneModel nav={false} />
            </group>
          ))}
        </group>
      );
    })}
  </group>
);

const Flights: React.FC<{ t: number; stopT: number }> = ({ t, stopT }) => {
  const list = activeFlights(t, stopT);
  return (
    <group>
      {list.map(({ i, a, b, u }) => {
        const p = flightPoint(a, b, u);
        const ahead = flightPoint(a, b, Math.min(1, u + 0.01)).sub(p);
        if (ahead.lengthSq() < 1e-8) ahead.set(0, 0, 1);
        const trail = Array.from({ length: 14 }, (_, k) => flightPoint(a, b, Math.max(0, u - k * 0.012)).toArray() as [number, number, number]);
        const color = i % 3 === 0 ? C.green : C.cyan;
        return (
          <group key={`${i}-${a}-${b}`}>
            <group position={p} rotation={orient(p, ahead)}>
              <PlaneModel />
            </group>
            <Line points={trail} color={color} lineWidth={2} transparent opacity={0.7} />
          </group>
        );
      })}
    </group>
  );
};

const Towers: React.FC<{ beats: Beats; frame: number }> = ({ beats, frame }) => {
  const tC = since(beats, frame, "centers");
  const tF = sinceFail(beats, frame);
  const tM = since(beats, frame, "money");
  const tQ = since(beats, frame, "question");
  return (
    <group>
      {CTR.map(([x, z], i) => {
        const rise = smooth(ramp(tC, i * 0.05, i * 0.05 + 0.7));
        const h = 0.18 + 1.05 * rise;
        const fAt = towerFailT(i);
        const failed = fAt !== null && tF >= fAt;
        const flick = failed ? 0.55 + 0.45 * Math.abs(Math.sin(frame * 0.5 + i * 1.7)) : 1;
        let color: string = C.cyan;
        if (failed) color = C.red;
        if (failed && tM >= 0) color = mix(C.red, C.amber, ramp(tM, 0, 1));
        if (failed && tQ >= 0) color = C.red;
        const lit = (failed ? flick : 1) * (0.6 + 0.4 * rise);
        return (
          <group key={i} position={[x, MAP_TOP, z]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.13, h, 0.13]} />
              <meshStandardMaterial color="#1A2440" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, h / 2, 0.067]}>
              <boxGeometry args={[0.03, h * 0.92, 0.004]} />
              {glow(color, 3 * lit)}
            </mesh>
            <mesh position={[0, h + 0.04, 0]}>
              <boxGeometry args={[0.2, 0.08, 0.2]} />
              {glow(color, 4 * lit)}
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <ringGeometry args={[0.16, 0.2, 32]} />
              {glow(color, 1.5 * lit, 0.8)}
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const Network: React.FC<{ beats: Beats; frame: number }> = ({ beats, frame }) => {
  const tF = sinceFail(beats, frame);
  const tFlood = since(beats, frame, "flood");
  const tWarn = since(beats, frame, "warned");
  const t = frame / FPS;
  const floodOn = tFlood >= 0 && tWarn < 0.5;
  return (
    <group>
      {LINKS.map(([a, b], i) => {
        const fa = towerFailT(a);
        const fb = towerFailT(b);
        const down = (fa !== null && tF >= fa) || (fb !== null && tF >= fb);
        const color = down ? C.red : C.cyan;
        const op = down ? 0.35 + 0.5 * Math.abs(Math.sin(frame * 0.35 + i)) : 0.8;
        const pts = LINK_POINTS[i];
        return (
          <group key={i}>
            <Line points={pts} color={color} lineWidth={2.2} transparent opacity={op} />
            {/* Data packets riding the link */}
            {down
              ? null
              : [0, 0.5].map((off) => {
                  const u = (t * 0.35 + off + random(`lk${i}`)) % 1;
                  const p = LINK_CURVES[i].getPoint(u);
                  return (
                    <mesh key={off} position={p}>
                      <sphereGeometry args={[0.035, 8, 8]} />
                      {glow("#BFF4FF", 6)}
                    </mesh>
                  );
                })}
          </group>
        );
      })}
      {floodOn
        ? FLOOD_CURVES.map((c, i) => {
            const grow = smooth(ramp(tFlood, 0.2 + i * 0.03, 0.8 + i * 0.03));
            const fade = 1 - ramp(tWarn, 0, 0.5);
            if (grow <= 0) return null;
            const pts = FLOOD_POINTS[i].slice(0, Math.max(2, Math.round(FLOOD_POINTS[i].length * grow)));
            return (
              <group key={`f${i}`}>
                <Line points={pts} color={C.red} lineWidth={2.4} transparent opacity={0.8 * fade} />
                {grow >= 1
                  ? [0, 1, 2, 3, 4].map((k) => {
                      const u = (tFlood * 0.9 + k / 5 + random(`fl${i}`)) % 1;
                      return (
                        <mesh key={k} position={c.getPoint(u)}>
                          <sphereGeometry args={[0.04, 8, 8]} />
                          {glow("#FF8A95", 7, fade)}
                        </mesh>
                      );
                    })
                  : null}
              </group>
            );
          })
        : null}
    </group>
  );
};

const cable = (side: number, k: number, lift: number) =>
  new THREE.CatmullRomCurve3([
    R(-0.24, 0.2 + k * 0.04, side * 0.12),
    R(-0.5, 0.18 + lift, side * (0.25 + k * 0.08)),
    R(-0.9 - k * 0.15, 0.02, side * (0.45 + k * 0.2)),
    R(-1.6 - k * 0.3, 0.0, side * (0.7 + k * 0.35)),
  ]);
const COPPER = [0, 1, 2].map((k) => new THREE.TubeGeometry(cable(1, k, 0.05), 40, 0.022, 8, false));
const FIBER = [0, 1, 2].map((k) => new THREE.TubeGeometry(cable(-1, k, 0.08), 40, 0.016, 8, false));

/** The box: a network router on a small plinth, LEDs on the front, cables out of the back. */
const Router: React.FC<{ beats: Beats; frame: number }> = ({ beats, frame }) => {
  const tR = since(beats, frame, "router");
  const tFlood = since(beats, frame, "flood");
  const tWarn = since(beats, frame, "warned");
  const flooding = tFlood >= 0 && tWarn < 0;
  // Copper fades and fiber draws in as the voice says "copper lines for fiber".
  const copper = 1 - ramp(tR, 1.7, 3.1);
  const fiber = ramp(tR, 1.2, 2.8);
  FIBER.forEach((g) => g.setDrawRange(0, Math.floor((g.index?.count ?? 0) * fiber)));
  const hot = flooding ? 0.5 + 0.5 * Math.abs(Math.sin(frame * 0.9)) : 0;
  return (
    <group>
      <group position={ROUTER}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.62, 0.12, 0.46]} />
          <meshStandardMaterial color="#1C2540" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.5, 0.15, 0.34]} />
          <meshStandardMaterial color={mix("#2A3557", "#4A1622", hot)} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* front LEDs */}
        {Array.from({ length: 8 }, (_, k) => {
          const blink = flooding ? (Math.sin(frame * 1.7 + k * 2.1) > 0 ? 1 : 0.15) : Math.sin(frame * 0.25 + k * 1.3) > -0.3 ? 1 : 0.3;
          return (
            <mesh key={k} position={[-0.19 + k * 0.054, 0.22, 0.172]}>
              <boxGeometry args={[0.022, 0.016, 0.006]} />
              {glow(flooding ? (k % 2 ? C.red : C.amber) : C.green, 6 * blink)}
            </mesh>
          );
        })}
        <mesh position={[0, 0.16, 0.172]}>
          <boxGeometry args={[0.42, 0.006, 0.004]} />
          {glow(flooding ? C.red : C.cyan, 3)}
        </mesh>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} position={[x, 0.36, -0.12]} rotation={[0.12, 0, x > 0 ? -0.15 : 0.15]}>
            <cylinderGeometry args={[0.008, 0.012, 0.22, 8]} />
            <meshStandardMaterial color="#10162A" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <pointLight position={[0, 0.5, 0.5]} color={flooding ? C.red : C.cyan} intensity={flooding ? 3 + 3 * hot : 2} distance={3} />
      </group>
      {copper > 0.01
        ? COPPER.map((g, k) => (
            <mesh key={`c${k}`} geometry={g}>
              <meshStandardMaterial color="#C8743A" metalness={0.9} roughness={0.3} emissive="#7A3A10" emissiveIntensity={0.6} transparent opacity={copper} />
            </mesh>
          ))
        : null}
      {fiber > 0.01
        ? FIBER.map((g, k) => (
            <mesh key={`f${k}`} geometry={g}>
              {glow(C.cyan, 3.5)}
            </mesh>
          ))
        : null}
    </group>
  );
};

const RadarAndSpacing: React.FC<{ beats: Beats; frame: number }> = ({ beats, frame }) => {
  const tT = since(beats, frame, "talk");
  const tL = since(beats, frame, "lost");
  const on = tT >= 0 && tL < 0.6 ? ramp(tT, 0, 0.5) * (1 - ramp(tL, 0, 0.6)) : 0;
  if (on <= 0) return null;
  const ctr = CTR[5];
  const sweep = frame * 0.09;
  const x = TALK[0] - 1.2 + tT * 0.25;
  const pa = v(x, 1.9, TALK[1]);
  const pb = v(x, 1.9, TALK[1] - 1.0);
  const dir = v(1, 0, 0);
  return (
    <group>
      <group position={[ctr[0], MAP_TOP + 0.03, ctr[1]]}>
        <mesh rotation={[-Math.PI / 2, 0, sweep]}>
          <circleGeometry args={[3.2, 48, 0, 0.7]} />
          {glow(C.cyan, 1.2, 0.18 * on)}
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.15, 3.2, 96]} />
          {glow(C.cyan, 1.5, 0.5 * on)}
        </mesh>
      </group>
      {[pa, pb].map((p, k) => (
        <group key={k} position={p} rotation={orient(p, dir)} scale={1.6}>
          <PlaneModel />
        </group>
      ))}
      <mesh position={pa} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.98, 1.02, 96]} />
        {glow(C.green, 3, on)}
      </mesh>
      <Line points={[pa.toArray() as [number, number, number], pb.toArray() as [number, number, number]]} color={C.green} lineWidth={2} dashed dashSize={0.06} gapSize={0.05} transparent opacity={on} />
      {/* radio link from the center to each plane */}
      {[pa, pb].map((p, k) => (
        <Line key={`r${k}`} points={[[ctr[0], MAP_TOP + 1.2, ctr[1]], p.toArray() as [number, number, number]]} color={C.cyan} lineWidth={1.5} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.7 * on} />
      ))}
    </group>
  );
};

const Outage2009: React.FC<{ beats: Beats; frame: number }> = ({ beats, frame }) => {
  const tW = since(beats, frame, "warned");
  const tM = since(beats, frame, "money");
  if (tW < 0 || tM > 0.8) return null;
  const fade = 1 - ramp(tM, 0, 0.8);
  return (
    <group>
      {DOTS_2009.map(({ p, when }, i) => {
        const on = tW >= when;
        if (!on) return null;
        const hit = 1 - ramp(tW, when, when + 0.5);
        return (
          <mesh key={i} position={[p[0], MAP_TOP + 0.04, p[1]]}>
            <cylinderGeometry args={[0.07 + hit * 0.08, 0.07 + hit * 0.08, 0.05, 12]} />
            {glow(C.amber, (1.5 + 5 * hit) * fade, fade)}
          </mesh>
        );
      })}
    </group>
  );
};

const Dust: React.FC<{ frame: number }> = ({ frame }) => {
  const base = useMemo(() => {
    const b = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      b[i * 3] = (random(`dx${i}`) - 0.5) * 26;
      b[i * 3 + 1] = random(`dy${i}`) * 6;
      b[i * 3 + 2] = (random(`dz${i}`) - 0.5) * 18;
    }
    return b;
  }, []);
  const pos = new Float32Array(base.length);
  for (let i = 0; i < 260; i++) {
    pos[i * 3] = base[i * 3] + Math.sin(frame * 0.01 + i) * 0.2;
    pos[i * 3 + 1] = (base[i * 3 + 1] + frame * 0.004 * (1 + (i % 3))) % 6;
    pos[i * 3 + 2] = base[i * 3 + 2];
  }
  return (
    <points key={frame}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#9FCBFF" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
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
  const t = frame / FPS;
  const stopT = beats.hit !== undefined ? beats.hit / FPS : 999;
  const tStop = since(beats, frame, "hit");
  return (
    <>
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 14, 38]} />
      <CameraRig pose={pose} />
      <ambientLight color="#41508A" intensity={0.55} />
      <hemisphereLight args={["#6A7CFF", "#120818", 0.5]} />
      <directionalLight position={[6, 12, 8]} intensity={0.9} color="#9DB8FF" />
      <pointLight position={[-8, 4, -6]} color="#FF4FD8" intensity={30} distance={22} />
      <pointLight position={[9, 4, 4]} color={C.cyan} intensity={30} distance={22} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[90, 90]} />
        <MeshReflectorMaterial
          blur={[400, 120]}
          resolution={1024}
          mixBlur={1}
          mixStrength={14}
          roughness={0.7}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#070C18"
          metalness={0.6}
          mirror={0.6}
        />
      </mesh>
      <gridHelper args={[60, 120, "#16223D", "#101A30"]} position={[0, 0.002, 0]} />
      <Land />
      <CityLights level={1} />
      <Network beats={beats} frame={frame} />
      <Towers beats={beats} frame={frame} />
      <Airports tStop={tStop} frame={frame} />
      <Flights t={t} stopT={stopT} />
      <Router beats={beats} frame={frame} />
      <RadarAndSpacing beats={beats} frame={frame} />
      <Outage2009 beats={beats} frame={frame} />
      <Dust frame={frame} />
      <WarmUp />
      <EffectComposer multisampling={4}>
        <DepthOfField target={pose.t.toArray() as [number, number, number]} focalLength={0.025} bokehScale={2.6} />
        <Bloom mipmapBlur luminanceThreshold={0.5} luminanceSmoothing={0.25} intensity={1.3} />
        <Vignette eskil={false} offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
};

// ---------------------------------------------------------------- HUD overlay (SVG kit)
const projector = (pose: Pose) => {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 120);
  cam.position.copy(pose.p);
  cam.lookAt(pose.t);
  cam.updateMatrixWorld();
  return (p: THREE.Vector3 | [number, number, number]) => {
    const q = (Array.isArray(p) ? v(p[0], p[1], p[2]) : p.clone()).project(cam);
    return { x: (q.x * 0.5 + 0.5) * W, y: (1 - (q.y * 0.5 + 0.5)) * H, front: q.z < 1 };
  };
};

/** Keep pinned tags inside the text-safe area. */
const safe = (x: number, y: number) => ({ x: Math.max(250, Math.min(830, x)), y: Math.max(380, Math.min(1240, y)) });

const Pin: React.FC<{ at: { x: number; y: number; front: boolean }; dx: number; dy: number; text: string; tone?: "cyan" | "red" | "amber" | "green" | "plain"; s: number }> = ({ at, dx, dy, text, tone, s }) => {
  if (!at.front || s <= 0.01) return null;
  const tag = safe(at.x + dx, at.y + dy);
  return <Callout x={at.x} y={at.y} tx={tag.x} ty={tag.y} text={text} tone={tone} s={s} />;
};

const Chip: React.FC<{ x: number; y: number; text: string; color?: string; s?: number }> = ({ x, y, text, color = K.white, s = 1 }) => {
  if (s <= 0.01) return null;
  const w = text.length * 15 + 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={clamp01(s)}>
      <rect x={-w / 2} y={-24} width={w} height={48} rx={10} fill={K.panel} stroke={color} strokeWidth={2} />
      <text x={0} y={8} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={color} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

const Overlay: React.FC<{ beats: Beats; frame: number; pose: Pose }> = ({ beats, frame, pose }) => {
  const proj = projector(pose);
  const s = (name: string, delay = 0, len = 0.35) => smooth(ramp(since(beats, frame, name), delay, delay + len));
  const out = (name: string) => 1 - smooth(ramp(since(beats, frame, name), -0.25, 0.05));
  const during = (name: string, next: string, delay = 0) => s(name, delay) * out(next);
  const tF = sinceFail(beats, frame);
  const failedCount = FAIL_AT.filter((f) => f !== null && tF >= f).length;
  const t = frame / FPS;
  const tStop = since(beats, frame, "hit");

  // Status HUD: the state of the national airspace system.
  const i = currentBeat(beats, frame);
  const lights = Array.from({ length: 8 }, (_, k) => {
    if (failedCount > 0 && k < Math.round((failedCount / 22) * 8) && i < ORDER.indexOf("money")) return "fail" as const;
    if (tStop >= 0 && i <= ORDER.indexOf("question")) return k % 2 === 0 ? ("warn" as const) : ("ok" as const);
    return "ok" as const;
  });
  let state = "ALL FLIGHTS NORMAL";
  let tone: "cyan" | "red" | "amber" | "green" = "green";
  if (tStop >= 0) [state, tone] = ["GROUND STOP", "red"];
  if (i >= ORDER.indexOf("centers")) [state, tone] = ["22 CENTERS", "cyan"];
  if (failedCount > 0) [state, tone] = [`${failedCount}/22 LINES DOWN`, "red"];
  if (i >= ORDER.indexOf("router")) [state, tone] = ["CAUSE: ROUTER", "amber"];
  if (i >= ORDER.indexOf("warned")) [state, tone] = ["2009: SAME NETWORK", "amber"];
  if (i >= ORDER.indexOf("money")) [state, tone] = ["FIX: $12.5B", "green"];
  if (i >= ORDER.indexOf("question")) [state, tone] = ["SAME NETWORK", "red"];

  const router = proj(R(0, 0.32, 0));
  const hookCard = 1 - smooth(ramp(t, 2.3, 2.8));
  const hours = Math.min(4, Math.max(0, since(beats, frame, "frozen")) * 2.2);

  // A plane in the air for the "kept going" label: the first active flight.
  const air = activeFlights(t, beats.hit !== undefined ? beats.hit / FPS : 999).find((f) => f.u > 0.25 && f.u < 0.75);
  const airAt = air ? proj(flightPoint(air.a, air.b, air.u)) : null;
  const tower = (k: number) => proj(v(CTR[k][0], MAP_TOP + 1.35, CTR[k][1]));
  const talkX = TALK[0] - 1.2 + Math.max(0, since(beats, frame, "talk")) * 0.25;
  const den = proj(v(DEN[0], MAP_TOP, DEN[1]));

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <KitDefs />
      <StatusBar y={300} label="AIRSPACE" states={lights} right={state} rightTone={tone} />

      {/* 1 hook */}
      <TitleCard y={470} line1="ONE BOX" line2="GROUNDED AMERICA" s={hookCard} />
      <Pin at={router} dx={-170} dy={-230} text="ONE ROUTER" tone="cyan" s={hookCard} />

      {/* 2 grounded */}
      <BigStat x={540} y={640} value="3RD" label="NATIONWIDE GROUND STOP EVER" color={K.white} size={200} s={during("grounded", "older")} />
      <Chip x={540} y={780} text="FIRST: 2001 · 9/11" color={K.amber} s={during("grounded", "older", 1.1)} />

      {/* 3 older */}
      <Chip x={540} y={460} text="FAA NETWORK CONTRACT · 2002" color={K.cyan} s={during("older", "flights")} />
      <Chip x={540} y={530} text="FIRST IPHONE · 2007" color={K.muted} s={during("older", "flights", 0.6)} />

      {/* 4 flights */}
      {airAt ? <Pin at={airAt} dx={airAt.x > 540 ? -160 : 160} dy={-150} text="IN THE AIR · KEEPS FLYING" tone="green" s={during("flights", "stop")} /> : null}

      {/* 5 stop */}
      <BigStat x={540} y={560} value="3:54" label="FAA ORDERS A GROUND STOP" color={K.red} size={190} s={s("hit") * out("centers")} />
      <Pin at={den} dx={170} dy={260} text="NO TAKEOFFS" tone="red" s={s("hit", 0.3) * out("centers")} />
      <Chip x={540} y={700} text={`NOTHING NEW TAKES OFF · ${hours >= 4 ? "4+" : hours.toFixed(1)} HRS`} color={K.red} s={s("frozen") * out("centers")} />

      {/* 6 centers */}
      <Pin at={tower(13)} dx={-120} dy={-220} text="22 CONTROL CENTERS" tone="cyan" s={during("centers", "talk", 0.6)} />

      {/* 7 talk */}
      <Pin at={proj(v(talkX, 1.9, TALK[1] - 0.5))} dx={190} dy={-180} text="5 MILES APART" tone="green" s={s("apart") * out("lost")} />
      <Chip x={380} y={1180} text="RADAR" color={K.cyan} s={during("talk", "lost", 1.2)} />
      <Chip x={560} y={1180} text="RADIO" color={K.cyan} s={during("talk", "lost", 1.5)} />
      <Chip x={760} y={1180} text="ONE NETWORK" color={K.white} s={during("talk", "lost", 1.8)} />

      {/* 8 lost */}
      <BigStat x={540} y={620} value={`${failedCount}`} label="OF 22 CENTERS LOSING LINES" color={K.red} size={230} s={during("lost", "cyber")} />

      {/* 9 cyber */}
      <g opacity={during("cyber", "router")}>
        <Checklist x={160} y={470} w={760} items={[{ text: "CYBERATTACK", ok: false }]} reveal={s("safe")} />
        <Chip x={540} y={650} text="OFFICIALS: NO" color={K.white} s={s("safe", 0.2)} />
      </g>

      {/* 10 router */}
      <Pin at={proj(R(-1.2, 0.04, 0.55))} dx={-60} dy={190} text="COPPER" tone="amber" s={during("router", "flood", 0.3)} />
      <Pin at={proj(R(-1.2, 0.04, -0.55))} dx={60} dy={-240} text="FIBER" tone="cyan" s={during("router", "flood", 1.0)} />
      <Chip x={540} y={460} text="CONTRACTOR: L3HARRIS" color={K.white} s={during("router", "flood", 0.2)} />

      {/* 11 flood */}
      <Waveform x={230} y={1010} w={620} h={160} t={t * 2.2} title="NETWORK TRAFFIC" note="1,000+ REQUESTS / 5 SEC" color={K.red} s={during("flood", "warned", 0.4)} />
      <Pin at={router} dx={-180} dy={-260} text="ONE ROUTER" tone="red" s={during("flood", "warned")} />

      {/* 12 warned */}
      <BigStat x={540} y={700} value={`${Math.round(129 * ramp(since(beats, frame, "warned"), 0.2, 2.6))}`} label="FACILITIES KNOCKED OUT · 2009" color={K.amber} size={220} s={during("warned", "money", 1.2)} />
      <Chip x={540} y={430} text="2009 · ROUTER MISTAKE" color={K.amber} s={during("warned", "money")} />
      <Chip x={540} y={1180} text="SOURCE: DOT INSPECTOR GENERAL" color={K.muted} s={during("warned", "money", 2)} />

      {/* 13 money */}
      <BigStat x={540} y={640} value="$12.5B" label="APPROVED TO FIX AIR TRAFFIC CONTROL" color={K.green} size={200} s={during("money", "question")} />

      {/* 14 question */}
      <TitleCard y={560} line1="WOULD YOU" line2="TRUST IT?" sub="COMMENT YES OR NO" accent={K.red} s={s("question", 1.6)} />

      <Disclaimer text="ILLUSTRATION · NOT TO SCALE · AI VOICE · SOURCES IN CAPTION" />
    </svg>
  );
};

// ---------------------------------------------------------------- stage
export const GroundStop3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const beats = useContext(BeatsContext);
  const pose = cameraAt(beats, frame, durationInFrames);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <ThreeCanvas
        width={W}
        height={H}
        camera={{ fov: FOV, near: 0.05, far: 120, position: pose.p.toArray() as [number, number, number] }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.25 }}
        onCreated={logRenderer}
      >
        <World beats={beats} frame={frame} pose={pose} />
      </ThreeCanvas>
      {/* Covers (beats.still is set) show the world only; the cover adds its own title. */}
      {beats.still === undefined ? <Overlay beats={beats} frame={frame} pose={pose} /> : null}
    </AbsoluteFill>
  );
};
