import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Icon } from "../Icon";
import { Pop, Rise, useEnter } from "../motion";
import { BODY, DISPLAY, useLayout, useTheme } from "../theme";
import type { Scene, Tone } from "../types";

type Of<T extends Scene["type"]> = Extract<Scene, { type: T }>;

/**
 * Renders "plain *highlighted* plain". In headlines the starred words take the accent colour;
 * with `marker` (small text, where lime on white is hard to read) they get an accent
 * background instead.
 */
export const Rich: React.FC<{ text: string; marker?: boolean }> = ({ text, marker = false }) => {
  const theme = useTheme();
  const light = theme.name === "light";
  const style: React.CSSProperties = marker
    ? {
        background: theme.accent,
        color: theme.onAccent,
        padding: "0 0.18em",
        borderRadius: "0.16em",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }
    : {
        color: theme.accent,
        WebkitTextStroke: light ? `0.014em ${theme.accentDeep}` : undefined,
        textShadow: light ? `0 0.05em 0 ${theme.accentDeep}` : "none",
      };
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <span key={i} style={style}>
            {part.slice(1, -1)}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

/** Chunky uppercase headline. */
const Display: React.FC<{ size: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  size,
  children,
  style,
}) => {
  const { u } = useLayout();
  const theme = useTheme();
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: size * u,
        lineHeight: 0.98,
        textTransform: "uppercase",
        color: theme.ink,
        textWrap: "balance",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Pill: React.FC<{ tone?: Tone; size?: number; children: React.ReactNode }> = ({
  tone = "dark",
  size = 30,
  children,
}) => {
  const { u } = useLayout();
  const theme = useTheme();
  const bg = tone === "accent" ? theme.accent : tone === "alert" ? theme.alert : theme.pill;
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: BODY,
        fontWeight: 900,
        fontSize: size * u,
        lineHeight: 1,
        textTransform: "uppercase",
        padding: `${size * 0.36 * u}px ${size * 0.62 * u}px`,
        borderRadius: 999,
        background: bg,
        color: tone === "accent" ? theme.onAccent : theme.pillText,
        border: tone === "dark" ? `${2 * u}px solid ${theme.pillBorder}` : "none",
      }}
    >
      {children}
    </div>
  );
};

/** Centres content in the zone between the tracker and the captions. */
const Frame: React.FC<{ align?: "center" | "start"; children: React.ReactNode }> = ({
  align = "center",
  children,
}) => {
  const { side, contentTop, contentBottom, height, u } = useLayout();
  const theme = useTheme();
  return (
    <AbsoluteFill
      style={{
        padding: `${contentTop}px ${side}px ${height - contentBottom}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "left",
        fontFamily: BODY,
        color: theme.ink,
        gap: 34 * u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const displaySize = (text: string, vertical: boolean) => {
  const n = text.replace(/\*/g, "").length;
  const base = n <= 12 ? 220 : n <= 22 ? 176 : n <= 36 ? 140 : 112;
  return vertical ? base : base * 0.8;
};

/** Slams in slightly oversized, like a stamp. */
const Slam: React.FC<{ delay?: number; children: React.ReactNode }> = ({ delay = 0, children }) => {
  const p = useEnter(delay, 13);
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${interpolate(p, [0, 1], [1.18, 1])})`,
      }}
    >
      {children}
    </div>
  );
};

/** Splits "a *b c* d" into words, remembering which ones are highlighted. */
const toWords = (text: string) =>
  text
    .split(/(\*[^*]+\*)/g)
    .flatMap((part) => {
      const marked = part.startsWith("*") && part.endsWith("*");
      return (marked ? part.slice(1, -1) : part)
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => (marked ? `*${word}*` : word));
    })
    // Keep stray punctuation ("*violet*?") attached to the word before it.
    .reduce<string[]>((out, word) => {
      if (/^[^\w*]+$/.test(word) && out.length) out[out.length - 1] += word;
      else out.push(word);
      return out;
    }, []);

/** One word of a statement, stamped in on its own beat. */
const StampWord: React.FC<{ word: string; delay: number }> = ({ word, delay }) => {
  const p = useEnter(delay, 11);
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: "0.22em",
        opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${interpolate(p, [0, 1], [1.7, 1])}) rotate(${interpolate(p, [0, 1], [-5, 0])}deg)`,
      }}
    >
      <Rich text={word} />
    </span>
  );
};

const Statement: React.FC<{ scene: Of<"statement"> }> = ({ scene }) => {
  const { vertical, u } = useLayout();
  const theme = useTheme();
  const words = toWords(scene.text);
  const rule = useEnter(0.15 + words.length * 0.13, 16);
  return (
    <Frame>
      {scene.tag ? (
        <Pop>
          <Pill tone={scene.tagTone}>{scene.tag}</Pill>
        </Pop>
      ) : null}
      <Display size={displaySize(scene.text, vertical)}>
        {words.map((word, i) => (
          <StampWord key={i} word={word} delay={0.08 + i * 0.13} />
        ))}
      </Display>
      <div style={{ width: 300 * u * rule, height: 16 * u, borderRadius: 8 * u, background: theme.accent }} />
    </Frame>
  );
};

/** Headline and tag sit above the stage and leave the middle of the frame to it. */
const Show: React.FC<{ scene: Of<"show"> }> = ({ scene }) => {
  const { side, headingTop, u, vertical } = useLayout();
  if (!scene.heading && !scene.tag) return null;
  return (
    <AbsoluteFill
      style={{
        padding: `${headingTop}px ${side}px 0`,
        display: "flex",
        flexDirection: "column",
        alignItems: scene.heading ? "flex-start" : "center",
        gap: 22 * u,
      }}
    >
      {scene.heading ? (
        <Slam>
          <Display size={vertical ? 116 : 92}>
            <Rich text={scene.heading} />
          </Display>
        </Slam>
      ) : null}
      {scene.tag ? (
        <Pop delay={scene.heading ? 0.25 : 0.1}>
          <Pill tone={scene.tagTone} size={scene.heading ? 28 : 34}>
            {scene.tag}
          </Pill>
        </Pop>
      ) : null}
    </AbsoluteFill>
  );
};

const Text: React.FC<{ scene: Of<"text"> }> = ({ scene }) => {
  const { u, vertical } = useLayout();
  const theme = useTheme();
  return (
    <Frame>
      {scene.icon ? (
        <Pop>
          <Icon name={scene.icon} size={230 * u} />
        </Pop>
      ) : null}
      <Slam delay={0.12}>
        <Display size={vertical ? 120 : 100}>
          <Rich text={scene.heading} />
        </Display>
      </Slam>
      {scene.body ? (
        <Rise delay={0.35}>
          <div style={{ fontSize: 46 * u, fontWeight: 700, lineHeight: 1.3, color: theme.muted }}>
            <Rich text={scene.body} marker />
          </div>
        </Rise>
      ) : null}
    </Frame>
  );
};

const Stat: React.FC<{ scene: Of<"stat"> }> = ({ scene }) => {
  const { u } = useLayout();
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0.15 * fps, 1.1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  return (
    <Frame>
      <Pop>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: 420 * u,
            lineHeight: 0.9,
            color: theme.accent,
            textShadow: `0 ${14 * u}px 0 ${theme.accentDeep}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {scene.prefix}
          {(scene.value * p).toFixed(scene.decimals)}
          {scene.suffix}
        </div>
      </Pop>
      <Rise delay={0.45}>
        <div style={{ fontSize: 54 * u, fontWeight: 900, lineHeight: 1.2 }}>
          <Rich text={scene.label} marker />
        </div>
      </Rise>
    </Frame>
  );
};

const Bar: React.FC<{
  bar: Of<"bars">["bars"][number];
  max: number;
  unit: string;
  index: number;
}> = ({ bar, max, unit, index }) => {
  const { u } = useLayout();
  const theme = useTheme();
  const grow = useEnter(0.35 + index * 0.22, 20);
  const color = bar.color ?? theme.palette[index % theme.palette.length];
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 42 * u,
          fontWeight: 900,
          marginBottom: 10 * u,
          textTransform: "uppercase",
        }}
      >
        <span>{bar.label}</span>
        <span style={{ opacity: grow }}>
          {bar.value}
          {unit}
        </span>
      </div>
      <div style={{ height: 64 * u, borderRadius: 14 * u, background: theme.grid }}>
        <div
          style={{
            width: `${(bar.value / max) * 100 * grow}%`,
            height: "100%",
            borderRadius: 14 * u,
            background: color,
            boxShadow: `0 ${8 * u}px 0 rgba(0,0,0,0.18)`,
          }}
        />
      </div>
    </div>
  );
};

const Bars: React.FC<{ scene: Of<"bars"> }> = ({ scene }) => {
  const { u } = useLayout();
  const max = Math.max(...scene.bars.map((b) => b.value));
  return (
    <Frame align="start">
      <Slam>
        <Display size={100}>
          <Rich text={scene.heading} />
        </Display>
      </Slam>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 40 * u }}>
        {scene.bars.map((bar, i) => (
          <Bar key={bar.label} bar={bar} max={max} unit={scene.unit} index={i} />
        ))}
      </div>
    </Frame>
  );
};

/** White (or dark) recap card, like the "save this" card that ends the reference. */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { u } = useLayout();
  const theme = useTheme();
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900 * u,
        background: theme.card,
        borderRadius: 30 * u,
        borderTop: `${14 * u}px solid ${theme.accent}`,
        boxShadow: `0 ${24 * u}px ${60 * u}px ${theme.shadow}`,
        padding: `${44 * u}px ${52 * u}px ${52 * u}px`,
        display: "flex",
        flexDirection: "column",
        gap: 26 * u,
        textAlign: "left",
      }}
    >
      {children}
    </div>
  );
};

const List: React.FC<{ scene: Of<"list"> }> = ({ scene }) => {
  const { u } = useLayout();
  const theme = useTheme();
  return (
    <Frame>
      <Pop>
        <Card>
          <Display size={92}>
            <Rich text={scene.heading} />
          </Display>
          {scene.items.map((item, i) => (
            <Rise key={item} delay={0.35 + i * 0.4} distance={30}>
              <div style={{ display: "flex", alignItems: "center", gap: 26 * u }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 78 * u,
                    height: 78 * u,
                    borderRadius: 16 * u,
                    background: theme.accent,
                    border: `${5 * u}px solid ${theme.ink}`,
                    color: theme.onAccent,
                    fontFamily: DISPLAY,
                    fontSize: 54 * u,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {scene.badges?.[i] ?? i + 1}
                </div>
                <div style={{ fontSize: 46 * u, fontWeight: 900, lineHeight: 1.15, textTransform: "uppercase" }}>
                  {item}
                </div>
              </div>
            </Rise>
          ))}
        </Card>
      </Pop>
    </Frame>
  );
};

const Outro: React.FC<{ scene: Of<"outro">; handle?: string }> = ({ scene, handle }) => {
  const { u, vertical } = useLayout();
  const theme = useTheme();
  return (
    <Frame>
      <Slam>
        <Display size={displaySize(scene.title, vertical)}>
          <Rich text={scene.title} />
        </Display>
      </Slam>
      <Pop delay={0.4}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16 * u,
            padding: `${22 * u}px ${52 * u}px`,
            borderRadius: 999,
            background: theme.pill,
            border: `${2 * u}px solid ${theme.pillBorder}`,
          }}
        >
          <span style={{ fontFamily: DISPLAY, fontSize: 68 * u, color: theme.accent, textTransform: "uppercase" }}>
            {scene.cta}
          </span>
          <span style={{ fontSize: 36 * u, fontWeight: 800, color: theme.pillText }}>{scene.ctaNote}</span>
        </div>
      </Pop>
      {handle ? (
        <Rise delay={0.7}>
          <div style={{ fontSize: 40 * u, fontWeight: 900, color: theme.muted }}>{handle}</div>
        </Rise>
      ) : null}
    </Frame>
  );
};

export const SceneView: React.FC<{ scene: Scene; handle?: string }> = ({ scene, handle }) => {
  switch (scene.type) {
    case "statement":
      return <Statement scene={scene} />;
    case "show":
      return <Show scene={scene} />;
    case "text":
      return <Text scene={scene} />;
    case "stat":
      return <Stat scene={scene} />;
    case "bars":
      return <Bars scene={scene} />;
    case "list":
      return <List scene={scene} />;
    case "outro":
      return <Outro scene={scene} handle={handle} />;
  }
};
