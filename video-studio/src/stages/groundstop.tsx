import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, useBeat } from "../beats";
import { Person, Tag } from "../props";
import { useTheme } from "../theme";

/**
 * Stage for "The router that grounded America" (FAA ground stop, 13 Nov 2026).
 * Beats: map (every airport red, planes aloft keep moving) -> frozen -> centers (the 22
 * en-route centers light up) -> talk (links between them) -> lost (links fail) ->
 * router (copper swapped for fiber at one site) -> flood (one router swamps the network).
 */
const US = [
  [95, 215], [480, 225], [560, 235], [600, 255], [650, 250], [690, 285], [735, 300], [770, 280],
  [880, 215], [905, 235], [880, 290], [850, 330], [835, 380], [800, 440], [770, 500], [790, 560],
  [810, 640], [790, 650], [760, 590], [730, 560], [660, 565], [600, 575], [560, 600], [520, 670],
  [490, 640], [450, 590], [410, 585], [330, 560], [250, 545], [200, 535], [150, 470], [110, 400],
  [90, 320], [85, 260],
];
// 22 points: stand in for airports first, then for the en-route control centers.
const SITES = [
  [130, 260], [150, 420], [215, 500], [250, 330], [300, 250], [340, 430], [390, 530], [420, 330],
  [470, 440], [500, 270], [520, 560], [570, 370], [610, 480], [640, 300], [670, 400], [700, 520],
  [730, 340], [760, 430], [780, 580], [800, 320], [840, 280], [690, 460],
];
const LINKS = [
  [0, 3], [3, 4], [1, 2], [2, 5], [3, 7], [5, 8], [7, 9], [8, 11], [6, 10], [9, 13], [11, 14],
  [10, 12], [12, 15], [13, 16], [14, 17], [16, 19], [19, 20], [15, 18], [17, 21], [5, 6], [7, 8],
];
const ROUTES = [
  { from: [130, 260], to: [840, 280], bend: -90, offset: 0.1 },
  { from: [780, 580], to: [150, 420], bend: -70, offset: 0.55 },
  { from: [215, 500], to: [800, 320], bend: 60, offset: 0.3 },
  { from: [640, 300], to: [390, 530], bend: 50, offset: 0.8 },
  { from: [500, 270], to: [700, 520], bend: -40, offset: 0.45 },
];
const NODES = [
  [760, 170], [900, 300], [930, 470], [820, 640], [620, 700], [560, 150],
];
const HUB = [520, 430];

const Plane: React.FC<{ x: number; y: number; angle: number; color: string; scale?: number }> = ({
  x,
  y,
  angle,
  color,
  scale = 1,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} fill={color}>
    <rect x={-22} y={-4} width={44} height={8} rx={4} />
    <polygon points="-2,-4 8,-4 -8,-24 -14,-24" />
    <polygon points="-2,4 8,4 -8,24 -14,24" />
    <polygon points="-22,-3 -16,-3 -24,-12 -27,-12" />
    <polygon points="-22,3 -16,3 -24,12 -27,12" />
  </g>
);

export const GroundStopStage: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const centers = useBeat("centers");
  const talk = useBeat("talk");
  const lost = useBeat("lost");
  const router = useBeat("router");
  const flood = useBeat("flood");

  const asCenters = centers.ramp(0.2, 1);
  const mapOut = 1 - router.ramp(0, 0.5);
  const roomIn = router.ramp(0.3, 0.8);
  const swap = router.ramp(1.6, 3);
  const shake = flood.on ? Math.sin(t * 60) * 4 * Math.min(1, flood.t) : 0;

  return (
    <g>
      {/* ---------- The country ---------- */}
      <g opacity={mapOut} transform="translate(-75 110) scale(1.15)">
        <polygon points={US.map((p) => p.join(",")).join(" ")} fill={theme.slateDark} opacity={0.55} />
        <polygon
          points={US.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={theme.slateLight}
          strokeWidth={4}
          strokeLinejoin="round"
        />

        {/* Voice links between centers; they turn red and break when the lines fail. */}
        {LINKS.map(([a, b], i) => {
          const grow = talk.enter(0.2 + i * 0.07, 18);
          if (grow <= 0.01) return null;
          const failing = lost.on && (i * 7) % 22 < 17;
          const cut = failing ? lost.ramp(0.2 + (i % 5) * 0.15, 0.8 + (i % 5) * 0.15) : 0;
          const [x1, y1] = SITES[a];
          const [x2, y2] = SITES[b];
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={lerp(x1, x2, grow)}
              y2={lerp(y1, y2, grow)}
              stroke={cut > 0 ? theme.alert : theme.accent}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={cut > 0 ? "6 14" : undefined}
              opacity={lerp(0.9, 0.35, cut)}
            />
          );
        })}

        {SITES.map(([x, y], i) => {
          const failing = lost.on && (i * 7) % 22 < 17 && lost.t > 0.2 + (i % 6) * 0.12;
          const red = asCenters < 0.5 || failing;
          const color = red ? theme.alert : theme.accent;
          const ring = ((t * 0.9 + i * 0.37) % 1);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={12 + ring * 26} fill="none" stroke={color} strokeWidth={3} opacity={(1 - ring) * 0.7} />
              <circle cx={x} cy={y} r={11} fill={color} />
              {asCenters < 0.5 ? (
                <g stroke={theme.ink} strokeWidth={3.5} strokeLinecap="round">
                  <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
                  <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} />
                </g>
              ) : null}
            </g>
          );
        })}

        {/* Flights already in the air keep going. */}
        {ROUTES.map((r, i) => {
          const p = (t * 0.07 + r.offset) % 1;
          const cx = (r.from[0] + r.to[0]) / 2;
          const cy = (r.from[1] + r.to[1]) / 2 + r.bend;
          const at = (q: number) => {
            const m = 1 - q;
            return [
              m * m * r.from[0] + 2 * m * q * cx + q * q * r.to[0],
              m * m * r.from[1] + 2 * m * q * cy + q * q * r.to[1],
            ];
          };
          const [x, y] = at(p);
          const [nx, ny] = at(Math.min(1, p + 0.01));
          const fade = Math.sin(p * Math.PI);
          return (
            <g key={i} opacity={fade}>
              <Plane x={x} y={y} angle={(Math.atan2(ny - y, nx - x) * 180) / Math.PI} color={theme.ink} scale={0.9} />
            </g>
          );
        })}
      </g>

      {/* ---------- The remote site ---------- */}
      <g opacity={roomIn} transform="translate(-60 120) scale(1.12)">
        {/* Network lines out to the control centers. */}
        {NODES.map(([x, y], i) => {
          const hit = flood.enter(0.9 + i * 0.35, 9);
          return (
            <g key={i}>
              <line x1={HUB[0]} y1={HUB[1]} x2={x} y2={y} stroke={theme.slate} strokeWidth={5} />
              {flood.on
                ? Array.from({ length: 6 }, (_, k) => {
                    const q = (t * 1.6 + k / 6 + i * 0.13) % 1;
                    return (
                      <circle
                        key={k}
                        cx={lerp(HUB[0], x, q)}
                        cy={lerp(HUB[1], y, q)}
                        r={8}
                        fill={theme.alert}
                        opacity={Math.min(1, flood.t * 2)}
                      />
                    );
                  })
                : null}
              <circle cx={x} cy={y} r={30 + hit * 6} fill={hit > 0.5 ? theme.alert : theme.accent} />
              <circle cx={x} cy={y} r={11} fill={theme.bg} />
              <circle cx={x} cy={y} r={34 + ((t + i * 0.2) % 1) * 22} fill="none" stroke={hit > 0.5 ? theme.alert : theme.accent} strokeWidth={3} opacity={1 - ((t + i * 0.2) % 1)} />
            </g>
          );
        })}

        {/* Old copper line out, new fiber line in. */}
        <line x1={-20} y1={HUB[1] + 24} x2={lerp(340, -20, swap)} y2={HUB[1] + 24} stroke="#C77B3A" strokeWidth={16} strokeLinecap="round" />
        <line x1={-20} y1={HUB[1] - 24} x2={lerp(-20, 340, swap)} y2={HUB[1] - 24} stroke={theme.accent} strokeWidth={12} strokeLinecap="round" />
        {swap > 0.95
          ? [0, 1, 2].map((k) => (
              <circle key={k} cx={((t * 420 + k * 120) % 360) - 20} cy={HUB[1] - 24} r={7} fill={theme.ink} />
            ))
          : null}
        <Tag x={150} y={HUB[1] + 78} text="COPPER" size={30} scale={router.enter(0.9, 10) * (1 - swap)} />
        <Tag x={150} y={HUB[1] - 78} text="FIBER" tone="accent" size={34} scale={router.enter(2.2, 9)} />

        {/* The router. */}
        <g transform={`translate(${HUB[0] + shake} ${HUB[1]})`}>
          <ellipse cx={0} cy={86} rx={210} ry={18} fill={theme.shadow} />
          <rect x={-190} y={-70} width={380} height={140} rx={22} fill={theme.slate} />
          <rect x={-190} y={34} width={380} height={36} rx={18} fill={theme.slateDark} />
          {Array.from({ length: 8 }, (_, i) => {
            const on = flood.on ? Math.sin(t * 30 + i * 2) > -0.3 : Math.sin(t * 5 + i * 1.3) > 0;
            return (
              <circle
                key={i}
                cx={-140 + i * 40}
                cy={-22}
                r={11}
                fill={flood.on ? theme.alert : theme.accent}
                opacity={on ? 1 : 0.25}
              />
            );
          })}
          {[-80, 80].map((x) => (
            <rect key={x} x={x - 5} y={-128} width={10} height={60} rx={5} fill={theme.slateLight} />
          ))}
        </g>
        <Tag x={HUB[0]} y={HUB[1] + 138} text="ONE ROUTER" size={40} display scale={router.enter(0.5, 9)} tone={flood.on ? "alert" : "dark"} />

        <g opacity={1 - flood.ramp(0, 0.4)}>
          <Person x={200} ground={690} h={150} color={theme.ink} hat />
          <Tag x={250} y={732} text="CONTRACTOR: L3HARRIS" size={30} scale={router.enter(1.2, 10)} />
        </g>
        <Tag x={430} y={255} text="1,000+ REQUESTS EVERY 5 SEC" tone="alert" size={34} scale={flood.enter(0.5, 8)} />
      </g>
    </g>
  );
};
