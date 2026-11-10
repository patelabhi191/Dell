import React from "react";
import { interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, useBeat } from "../beats";
import { House, Person, Wave } from "../props";
import { STAGE, useTheme } from "../theme";

/**
 * Stage for "Why is the sky blue?".
 * Beats: intro (sun appears) -> light (beam reaches the ground) -> waves (beam splits into
 * colours) -> scatter (air bounces the blue around) -> sunset (sun drops, sky turns orange).
 */
const NOON = [250, 235];
const LOW = [110, 660];
const EYE = [712, 690];
const RED = "#F04E23";
const GREEN = "#2FB86A";
const BLUE = "#2F7BF6";
const BURSTS = [
  [330, 330], [470, 250], [600, 380], [420, 520], [250, 560],
  [700, 300], [830, 520], [560, 610], [160, 420],
];
const MOLECULES = [
  [280, 250], [390, 420], [520, 330], [640, 250], [760, 410], [860, 620], [610, 500],
  [470, 640], [330, 660], [200, 510], [540, 180], [760, 560], [140, 640], [420, 150],
];

export const SkyStage: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const intro = useBeat("intro");
  const light = useBeat("light");
  const waves = useBeat("waves");
  const scatter = useBeat("scatter");
  const sunset = useBeat("sunset");

  const appear = Math.max(intro.enter(0.2, 10), light.enter(0, 10));
  const beam = light.ramp(0.2, 0.9);
  const split = waves.ramp(0.1, 0.8);
  const bounce = scatter.ramp(0.3, 1.4);
  const drop = sunset.ramp(0.2, 2);
  const set = drop * drop * (3 - 2 * drop);

  const sun = [lerp(NOON[0], LOW[0], set), lerp(NOON[1], LOW[1], set)];
  const dx = EYE[0] - sun[0];
  const dy = EYE[1] - sun[1];
  const length = Math.hypot(dx, dy) - 110;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Blue stops part-way once the air starts scattering it; much earlier at sunset.
  const blueReach = lerp(1, lerp(0.55, 0.2, set), bounce);
  const sunColor = interpolateColors(set, [0, 1], ["#FFC61A", "#F2711C"]);
  const sky = interpolateColors(set, [0, 1], [BLUE, "#F58A1F"]);

  return (
    <g>
      {/* The atmosphere: a dome over the ground that takes on the colour we see. */}
      <path
        d={`M 20,${STAGE.ground} A 480 590 0 0 1 980,${STAGE.ground} Z`}
        fill={sky}
        opacity={lerp(0.26, 0.34, set) * bounce}
      />
      <path
        d={`M 20,${STAGE.ground} A 480 590 0 0 1 980,${STAGE.ground}`}
        fill="none"
        stroke={theme.slateLight}
        strokeWidth={4}
        strokeDasharray="4 16"
        strokeLinecap="round"
        opacity={bounce * 0.9}
      />
      {MOLECULES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill={theme.slate} opacity={scatter.enter(0.1 + i * 0.04) * 0.75} />
      ))}

      {/* Blue light bouncing off air molecules in every direction. */}
      {BURSTS.map(([x, y], i) => {
        const pop = scatter.enter(0.5 + i * 0.12, 9);
        if (pop <= 0.01) return null;
        const pulse = 20 + 9 * Math.sin(t * 5 + i * 1.7);
        return (
          <g key={i} opacity={pop * lerp(1, 0.25, set)} stroke={BLUE} strokeWidth={7} strokeLinecap="round">
            {Array.from({ length: 6 }, (_, k) => {
              const a = (k / 6) * Math.PI * 2 + i;
              return (
                <line
                  key={k}
                  x1={x + Math.cos(a) * 15}
                  y1={y + Math.sin(a) * 15}
                  x2={x + Math.cos(a) * (15 + pulse * pop)}
                  y2={y + Math.sin(a) * (15 + pulse * pop)}
                />
              );
            })}
            <circle cx={x} cy={y} r={8} fill={BLUE} stroke="none" />
          </g>
        );
      })}

      <rect x={10} y={STAGE.ground} width={980} height={14} rx={7} fill={theme.slateLight} opacity={appear} />
      <House x={800} ground={STAGE.ground} w={110} h={90} grow={appear} />
      <Person x={720} ground={STAGE.ground} h={170} opacity={appear} />

      {/* Sunlight: one pale beam that splits into colour waves. */}
      <g transform={`translate(${sun[0]} ${sun[1]}) rotate(${angle})`}>
        <line
          x1={86}
          y1={0}
          x2={86 + length * beam}
          y2={0}
          stroke="#FFD23F"
          strokeWidth={30}
          strokeLinecap="round"
          opacity={beam > 0 ? 1 - split : 0}
        />
        <g transform="translate(86 0)" opacity={split}>
          <g transform="translate(0 -36)">
            <Wave length={length} wavelength={150} amp={15} color={RED} phase={t * 6} />
          </g>
          <Wave length={length} wavelength={104} amp={14} color={GREEN} phase={t * 7} />
          <g transform="translate(0 36)">
            <Wave length={length * blueReach} wavelength={60} amp={12} color={BLUE} phase={t * 9} />
          </g>
        </g>
      </g>

      <g transform={`translate(${sun[0]} ${sun[1]}) scale(${appear})`}>
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            x={-8}
            y={-108}
            width={16}
            height={30}
            rx={8}
            fill={sunColor}
            transform={`rotate(${i * 36 + t * 8})`}
          />
        ))}
        <circle r={64} fill={sunColor} />
      </g>
    </g>
  );
};
