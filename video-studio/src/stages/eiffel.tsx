import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, useBeat } from "../beats";
import { Cash, Person, Tag } from "../props";
import { BODY, STAGE, useTheme } from "../theme";

/**
 * Stage for "The man who sold the Eiffel Tower".
 * Beats: tower (tower rises, Lustig arrives) -> meeting (forged letter, six dealers) ->
 * pitch (for sale, top secret) -> sold (Poisson pays, Lustig leaves) -> again (he returns).
 */
const G = STAGE.ground;
const CX = 290;
const DEALERS = [650, 708, 766, 824, 882, 940];
const POISSON = 2;

const Tower: React.FC<{ grow: number }> = ({ grow }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const right = [[150, G], [128, 760], [84, 600], [60, 520], [46, 430], [30, 330], [16, 220], [8, 130], [0, 95]];
  const outline = [...right.map(([x, y]) => [CX + x, y]), ...right.reverse().map(([x, y]) => [CX - x, y])];
  return (
    <g transform={`translate(0 ${G}) scale(1 ${Math.max(grow, 0.001)}) translate(0 ${-G})`}>
      <ellipse cx={CX} cy={G + 8} rx={190} ry={16} fill={theme.shadow} />
      <polygon points={outline.map((p) => p.join(",")).join(" ")} fill={theme.slate} />
      <path d={`M ${CX - 104},${G} Q ${CX},600 ${CX + 104},${G} Z`} fill={theme.bg} />
      {[[760, 128], [520, 60], [330, 30]].map(([y, half]) => (
        <rect key={y} x={CX - half} y={y - 4} width={half * 2} height={8} fill={theme.slateDark} />
      ))}
      <rect x={CX - 104} y={594} width={208} height={20} rx={4} fill={theme.slateLight} />
      <rect x={CX - 58} y={424} width={116} height={16} rx={4} fill={theme.slateLight} />
      <rect x={CX - 26} y={214} width={52} height={14} rx={4} fill={theme.slateLight} />
      <rect x={CX - 3} y={48} width={6} height={50} fill={theme.slateLight} />
      <circle cx={CX} cy={46} r={9 + 2 * Math.sin(frame / 6)} fill={theme.accent} />
    </g>
  );
};

const Letter: React.FC<{ scale: number; opacity: number }> = ({ scale, opacity }) => {
  const theme = useTheme();
  if (scale <= 0.01 || opacity <= 0.01) return null;
  return (
    <g transform={`translate(790 330) rotate(-4) scale(${scale})`} opacity={opacity}>
      <rect x={-130} y={-90} width={260} height={180} rx={10} fill="#F4F1E6" />
      <text x={-106} y={-52} fontFamily={BODY} fontWeight={900} fontSize={22} fill="#1B1B1B">
        MINISTRY OF POSTS
      </text>
      {[-24, 2, 28].map((y) => (
        <rect key={y} x={-106} y={y} width={y === 28 ? 130 : 212} height={10} rx={5} fill="#C9C5B6" />
      ))}
      <g transform="translate(62 54) rotate(-9)">
        <rect x={-58} y={-18} width={116} height={36} rx={6} fill="none" stroke={theme.alert} strokeWidth={4} />
        <text x={0} y={7} textAnchor="middle" fontFamily={BODY} fontWeight={900} fontSize={18} fill={theme.alert}>
          OFFICIAL
        </text>
      </g>
    </g>
  );
};

export const EiffelStage: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tower = useBeat("tower");
  const meeting = useBeat("meeting");
  const pitch = useBeat("pitch");
  const sold = useBeat("sold");
  const again = useBeat("again");

  // Lustig walks in, leaves with the money, then comes back for round two.
  const arrive = tower.ramp(1.6, 2.6);
  const leave = sold.ramp(3.4, 4.6);
  const back = again.ramp(0.2, 1.2);
  const lustigX = lerp(lerp(lerp(1150, 560, arrive), -160, leave), 560, back);
  const pay = sold.ramp(0.7, 1.6);
  const cashX = lerp(DEALERS[POISSON], 560, pay);
  const cashY = 720 - Math.sin(pay * Math.PI) * 130;
  const swing = again.on ? Math.sin(frame / 5) * 3 * (1 - again.ramp(0.5, 2)) : 0;

  const t = frame / fps;
  const night = tower.enter(0, 20);
  const sweep = Math.sin(t * 0.9) * 38;
  const train = sold.ramp(3.0, 5.8);

  return (
    <g>
      {/* Night sky: twinkling stars, a moon, and the city behind. */}
      {Array.from({ length: 34 }, (_, i) => (
        <circle
          key={i}
          cx={random(`sx${i}`) * 1060 - 30}
          cy={random(`sy${i}`) * 520 - 40}
          r={2 + random(`sr${i}`) * 3}
          fill={theme.ink}
          opacity={night * (0.35 + 0.45 * Math.sin(t * (1.5 + random(`sv${i}`) * 3) + i))}
        />
      ))}
      <g opacity={night} transform={`translate(860 ${110 + Math.sin(t * 0.5) * 6})`}>
        <circle r={52} fill={theme.ink} />
        <circle cx={22} cy={-12} r={46} fill={theme.bg} />
      </g>
      {Array.from({ length: 14 }, (_, i) => {
        const w = 50 + random(`bw${i}`) * 40;
        const h = (50 + random(`bh${i}`) * 110) * tower.enter(0.2 + i * 0.05, 16);
        const x = -40 + i * 78;
        return (
          <g key={i} opacity={0.5}>
            <rect x={x} y={G - h} width={w} height={h} fill={theme.slateDark} />
            {h > 60 ? <rect x={x + w * 0.3} y={G - h + 16} width={10} height={12} fill={theme.accent} opacity={0.5 + 0.5 * Math.sin(t * 2 + i * 1.3)} /> : null}
          </g>
        );
      })}

      {/* Searchlight sweeping from the top of the tower. */}
      <polygon
        points={`${CX},46 ${CX - 70},-420 ${CX + 70},-420`}
        fill={theme.accent}
        opacity={0.13 * tower.enter(1, 20)}
        transform={`rotate(${sweep} ${CX} 46)`}
      />

      {/* The getaway train crosses behind everything. */}
      {train > 0 && train < 1 ? (
        <g transform={`translate(${lerp(1150, -520, train)} ${G - 4})`}>
          {[0, 1, 2].map((c) => (
            <g key={c} transform={`translate(${c * 150} 0)`}>
              <rect x={0} y={-62} width={138} height={50} rx={8} fill={c === 0 ? theme.alert : theme.slateLight} />
              {c > 0 ? [18, 58, 98].map((wx) => <rect key={wx} x={wx} y={-52} width={24} height={18} rx={3} fill={theme.accent} />) : <rect x={84} y={-52} width={36} height={18} rx={3} fill={theme.accent} />}
              <circle cx={30} cy={-8} r={11} fill={theme.ink} />
              <circle cx={108} cy={-8} r={11} fill={theme.ink} />
            </g>
          ))}
          {[0, 1, 2, 3].map((p) => {
            const life = (t * 1.6 + p * 0.25) % 1;
            return <circle key={p} cx={20 + life * 90} cy={-80 - life * 70} r={10 + life * 16} fill={theme.slateLight} opacity={0.6 * (1 - life)} />;
          })}
        </g>
      ) : null}

      <Tower grow={tower.enter(0.1, 18)} />
      <Tag x={500} y={290} text="RUSTING. COSTLY." tone="alert" size={30} scale={tower.enter(1, 10) * (1 - meeting.ramp(0, 0.3))} />

      <Letter scale={meeting.enter(0.2, 11)} opacity={1 - pitch.ramp(0, 0.4)} />

      {DEALERS.map((x, i) => {
        const inRoom = meeting.enter(0.9 + i * 0.12);
        const isPoisson = i === POISSON;
        const fade = isPoisson ? 1 - again.ramp(0, 0.5) : lerp(1, 0.28, sold.ramp(0.2, 0.7) * (1 - again.ramp(0, 0.6)));
        return (
          <g key={x} transform={`translate(0 ${(1 - inRoom) * 40})`}>
            <Person
              x={x}
              ground={G}
              h={140}
              color={isPoisson && sold.on ? theme.ink : theme.slateLight}
              opacity={inRoom * fade}
            />
          </g>
        );
      })}
      {/* The dealers wonder, one after another, during the pitch. */}
      {DEALERS.map((x, i) => (
        <Tag
          key={x}
          x={x}
          y={G - 176 - (i % 2) * 34}
          text="?"
          size={30}
          display
          scale={pitch.enter(0.8 + i * 0.35, 8) * (1 - pitch.ramp(4.2 + i * 0.1, 4.6 + i * 0.1)) * (sold.on ? 0 : 1)}
        />
      ))}
      <Tag x={DEALERS[POISSON]} y={G - 222} text="!" tone="accent" size={34} display scale={sold.enter(0.1, 7) * (1 - sold.ramp(1.2, 1.5))} />
      <Tag x={DEALERS[POISSON]} y={G - 172} text="POISSON" size={26} scale={sold.enter(0.2, 10) * (1 - again.ramp(0, 0.4))} />

      <g transform={`rotate(${-6 + swing} ${CX} 470)`}>
        <Tag x={CX} y={500} text="FOR SALE" tone="accent" size={46} display scale={pitch.enter(0.3, 9)} />
      </g>
      <Tag x={660} y={220} text="7,000 TONS OF IRON" size={30} scale={pitch.enter(1.2, 10) * (1 - sold.ramp(0, 0.3))} />
      <Tag x={800} y={420} text="TOP SECRET" tone="alert" size={34} display rotate={7} scale={pitch.enter(2.4, 8) * (1 - sold.ramp(0, 0.3))} />

      <Tag x={CX + 20} y={590} text="SOLD" tone="alert" size={54} display rotate={-11} scale={sold.enter(1.7, 8) * (1 - again.ramp(0, 0.3))} />
      <Tag x={650} y={250} text="NEXT TRAIN TO VIENNA" size={30} scale={sold.enter(3.2, 10) * (1 - again.ramp(0, 0.3))} />
      <Tag x={740} y={320} text="ROUND TWO" tone="accent" size={44} display rotate={5} scale={again.enter(1.3, 8)} />

      <g opacity={arrive > 0 ? 1 : 0}>
        <Person x={lustigX} ground={G} h={172} color={theme.accent} hat />
        <Tag x={lustigX} y={G - 222} text="LUSTIG" size={26} scale={tower.enter(2.6, 10)} />
      </g>
      <Cash
        x={pay < 1 ? cashX : lustigX + 46}
        y={pay < 1 ? cashY : 720}
        opacity={sold.on && pay > 0 ? 1 - again.ramp(0, 0.3) : 0}
      />
    </g>
  );
};
