// 3D test shot: a dark shop at night with glowing security gates, a reflective floor, neon rim
// light, drifting particles and depth of field. Rendered with @remotion/three (WebGL); set
// REMOTION_GL=angle to render it on the NVIDIA GPU. Everything is driven by the frame number,
// so every render is identical.
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { interpolate, useCurrentFrame, useDelayRender, useVideoConfig, Easing } from "remotion";

const C = {
  bg: "#070B14",
  cyan: "#2ED3FF",
  red: "#FF4D5E",
  amber: "#FFB23F",
  green: "#3BE38B",
  pink: "#FF4FD8",
  purple: "#8A5CFF",
};

// Small seeded random so shelves and particles are the same on every frame and every render.
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// Frame at which the gate "catches" a tag and flips from cyan to red.
const ALARM_AT = 70;

const Camera: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const camera = useThree((s) => s.camera);
  const t = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  // Slow dolly toward the gates with a gentle orbit and a slight drop to floor level.
  const z = interpolate(t, [0, 1], [12, 4.2]);
  const x = interpolate(t, [0, 1], [-4.2, 2.2]);
  const y = interpolate(t, [0, 1], [2.8, 1.3]);
  camera.position.set(x, y, z);
  camera.lookAt(0, 1.05, 0);
  return null;
};

const neon = (color: string, intensity: number) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
);

// One security pedestal: dark base, two glowing posts, a translucent panel with antenna bars.
const Pedestal: React.FC<{ x: number; color: THREE.Color; glow: number }> = ({ x, color, glow }) => {
  const hex = `#${color.getHexString()}`;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.3, 0.12, 0.95]} />
        <meshStandardMaterial color="#2a3350" metalness={0.9} roughness={0.25} />
      </mesh>
      {[-0.42, 0.42].map((dz) => (
        <mesh key={dz} position={[0, 1.0, dz]}>
          <boxGeometry args={[0.07, 1.8, 0.07]} />
          {neon(hex, glow * 2.2)}
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.91]} />
        {neon(hex, glow * 2.2)}
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.03, 1.74, 0.8]} />
        <meshStandardMaterial
          color={hex}
          emissive={hex}
          emissiveIntensity={glow * 0.35}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      {[0.45, 0.8, 1.15, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.035, 0.025, 0.78]} />
          {neon(hex, glow * 1.4)}
        </mesh>
      ))}
      <pointLight position={[0, 1.1, 0]} color={hex} intensity={glow * 6} distance={4} decay={2} />
    </group>
  );
};

const Gates: React.FC = () => {
  const frame = useCurrentFrame();
  const alarm = frame >= ALARM_AT;
  const flash = alarm ? 0.6 + 0.4 * Math.abs(Math.sin((frame - ALARM_AT) * 0.45)) : 0;
  const idle = 0.85 + 0.15 * Math.sin(frame * 0.18);
  const mix = interpolate(frame, [ALARM_AT - 4, ALARM_AT + 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const color = new THREE.Color(C.cyan).lerp(new THREE.Color(C.red), mix);
  const glow = alarm ? 1.2 + flash : idle;
  return (
    <group>
      {[-1.6, 0, 1.6].map((x) => (
        <Pedestal key={x} x={x} color={color} glow={glow} />
      ))}
    </group>
  );
};

const PRODUCT_COLORS = [C.pink, C.amber, C.green, C.cyan, C.purple, "#FF7A45", "#F2F6FF"];

const Shelves: React.FC = () => {
  const items = useMemo(() => {
    const r = rng(7);
    const out: { pos: [number, number, number]; size: [number, number, number]; color: string; e: number }[] = [];
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 7; bay++) {
        const z = -12 + bay * 2.2;
        for (let shelf = 0; shelf < 4; shelf++) {
          const y = 0.35 + shelf * 0.62;
          let off = -0.9;
          while (off < 0.9) {
            const w = 0.18 + r() * 0.22;
            const h = 0.2 + r() * 0.3;
            out.push({
              pos: [side * (4.6 - r() * 0.15), y + h / 2, z + off + w / 2],
              size: [0.3, h, w],
              color: PRODUCT_COLORS[Math.floor(r() * PRODUCT_COLORS.length)],
              e: 0.6 + r() * 0.8,
            });
            off += w + 0.04;
          }
        }
      }
    }
    return out;
  }, []);
  return (
    <group>
      {[-1, 1].map((side) =>
        Array.from({ length: 7 }, (_, bay) => (
          <group key={`${side}-${bay}`} position={[side * 4.75, 0, -12 + bay * 2.2]}>
            {[0, 1, 2, 3].map((shelf) => (
              <mesh key={shelf} position={[0, 0.32 + shelf * 0.62, 0]}>
                <boxGeometry args={[0.6, 0.04, 2.0]} />
                <meshStandardMaterial color="#1b2236" metalness={0.7} roughness={0.35} />
              </mesh>
            ))}
            <mesh position={[side * 0.25, 1.3, 0]}>
              <boxGeometry args={[0.05, 2.6, 2.05]} />
              <meshStandardMaterial color="#0d1322" metalness={0.5} roughness={0.5} />
            </mesh>
            {/* LED strip on the front edge of each bay */}
            <mesh position={[-side * 0.31, 2.62, 0]}>
              <boxGeometry args={[0.03, 0.03, 2.0]} />
              {neon(side < 0 ? C.pink : C.cyan, 3)}
            </mesh>
          </group>
        )),
      )}
      {items.map((it, i) => (
        <mesh key={i} position={it.pos}>
          <boxGeometry args={it.size} />
          <meshStandardMaterial
            color={it.color}
            emissive={it.color}
            emissiveIntensity={it.e}
            metalness={0.2}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
};

const Room: React.FC = () => {
  const frame = useCurrentFrame();
  const flicker = 0.9 + 0.1 * Math.sin(frame * 1.7) * Math.sin(frame * 0.31);
  return (
    <group>
      {/* Back wall with neon tubes */}
      <mesh position={[0, 3, -14]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#0a0f1d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.6, -13.9]}>
        <boxGeometry args={[6.5, 0.09, 0.09]} />
        {neon(C.pink, 5 * flicker)}
      </mesh>
      <mesh position={[0, 3.25, -13.9]}>
        <boxGeometry args={[4.2, 0.07, 0.07]} />
        {neon(C.purple, 5)}
      </mesh>
      <mesh position={[-3.6, 2.4, -13.9]}>
        <torusGeometry args={[0.55, 0.05, 12, 48]} />
        {neon(C.amber, 4.5)}
      </mesh>
      <mesh position={[3.6, 2.4, -13.9]}>
        <torusGeometry args={[0.55, 0.05, 12, 48]} />
        {neon(C.green, 4.5)}
      </mesh>
      {/* Ceiling light strips */}
      {[-2, 0, 2].map((x) =>
        [-10, -6, -2, 2, 6].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 4.2, z]}>
            <boxGeometry args={[0.12, 0.03, 2.4]} />
            {neon("#BFE9FF", 2.2)}
          </mesh>
        )),
      )}
      {/* Cyan guide lines on the floor through the gates */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.006, 3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 9]} />
          {neon(C.cyan, 2.5)}
        </mesh>
      ))}
    </group>
  );
};

const Floor: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -3]}>
    <planeGeometry args={[40, 40]} />
    <MeshReflectorMaterial
      blur={[300, 80]}
      resolution={1024}
      mixBlur={1}
      mixStrength={45}
      roughness={0.55}
      depthScale={1.1}
      minDepthThreshold={0.4}
      maxDepthThreshold={1.4}
      color="#0b1020"
      metalness={0.6}
      mirror={0.85}
    />
  </mesh>
);

const PARTICLES = 900;

const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  const { base, speed, colors } = useMemo(() => {
    const r = rng(42);
    const b = new Float32Array(PARTICLES * 3);
    const s = new Float32Array(PARTICLES);
    const c = new Float32Array(PARTICLES * 3);
    const palette = [C.cyan, C.pink, C.amber, C.purple, C.green].map((h) => new THREE.Color(h));
    for (let i = 0; i < PARTICLES; i++) {
      b[i * 3] = (r() - 0.5) * 9;
      b[i * 3 + 1] = r() * 4.2;
      b[i * 3 + 2] = -13 + r() * 20;
      s[i] = 0.004 + r() * 0.012;
      const col = palette[Math.floor(r() * palette.length)];
      c.set([col.r * 2, col.g * 2, col.b * 2], i * 3);
    }
    return { base: b, speed: s, colors: c };
  }, []);
  const positions = useMemo(() => new Float32Array(PARTICLES * 3), []);
  for (let i = 0; i < PARTICLES; i++) {
    positions[i * 3] = base[i * 3] + Math.sin(frame * 0.03 + i) * 0.08;
    positions[i * 3 + 1] = (base[i * 3 + 1] + frame * speed[i]) % 4.2;
    positions[i * 3 + 2] = base[i * 3 + 2];
  }
  return (
    <points key={frame}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
};

const Lights: React.FC = () => (
  <>
    <ambientLight color="#3a4a8a" intensity={0.35} />
    <hemisphereLight args={["#5a6cff", "#200a30", 0.4]} />
    {/* Neon rim lights from behind the gates */}
    <spotLight position={[-4, 4, -5]} angle={0.6} penumbra={0.8} intensity={120} color={C.pink} target-position={[0, 1, 0]} />
    <spotLight position={[4, 4, -5]} angle={0.6} penumbra={0.8} intensity={120} color={C.cyan} target-position={[0, 1, 0]} />
    <pointLight position={[0, 3.4, -12]} color={C.purple} intensity={40} distance={14} />
    <pointLight position={[2.5, 1.5, 6]} color={C.amber} intensity={10} distance={10} />
  </>
);

// The post-processing composer is not ready on the very first advance() in a fresh browser
// tab, so that frame came out blank. On the first frame each tab renders, advance a couple more
// times (holding the render until done) so the composer has drawn the picture.
const WarmUp: React.FC = () => {
  const advance = useThree((s) => s.advance);
  const { delayRender, continueRender } = useDelayRender();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const handle = delayRender("Warming up post-processing");
    let n = 0;
    const tick = () => {
      advance(performance.now());
      if (++n < 3) requestAnimationFrame(tick);
      else continueRender(handle);
    };
    requestAnimationFrame(tick);
  }, [advance, delayRender, continueRender]);
  return null;
};

// Logs which graphics card WebGL is using, so a render log shows GPU vs software rendering.
const logRenderer = ({ gl }: { gl: THREE.WebGLRenderer }) => {
  const ctx = gl.getContext();
  const ext = ctx.getExtension("WEBGL_debug_renderer_info");
  const name = ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER);
  console.log(`[three] WebGL renderer: ${name}`);
};

export const ShopNight3D: React.FC<{ post?: boolean }> = ({ post = true }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ background: C.bg }}
      camera={{ fov: 42, near: 0.1, far: 80, position: [0, 2, 13] }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
      onCreated={logRenderer}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 10, 32]} />
      <Camera />
      <Lights />
      <Room />
      <Shelves />
      <Gates />
      <Floor />
      <Particles />
      {post ? <WarmUp /> : null}
      {post ? (
        <EffectComposer multisampling={4}>
          <DepthOfField target={[0, 1.05, 0]} focalLength={0.03} bokehScale={3.5} />
          <Bloom mipmapBlur luminanceThreshold={0.25} luminanceSmoothing={0.3} intensity={1.7} />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
        </EffectComposer>
      ) : null}
    </ThreeCanvas>
  );
};
