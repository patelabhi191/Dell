import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Icon } from "../Icon";
import { Pop, Rise, useEnter } from "../motion";
import { FONT, useLayout, useTheme } from "../theme";
import type { Scene } from "../types";

type Of<T extends Scene["type"]> = Extract<Scene, { type: T }>;

/** Centres content inside the platform-safe area. */
const Frame: React.FC<{ align?: "center" | "start"; children: React.ReactNode }> = ({
  align = "center",
  children,
}) => {
  const { safe, u } = useLayout();
  const theme = useTheme();
  return (
    <AbsoluteFill
      style={{
        padding: `${safe.top}px ${safe.side}px ${safe.bottom}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "left",
        fontFamily: FONT,
        color: theme.text,
        gap: 36 * u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Heading: React.FC<{ size?: number; children: React.ReactNode }> = ({
  size = 84,
  children,
}) => {
  const { u } = useLayout();
  return (
    <div style={{ fontSize: size * u, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 * u }}>
      {children}
    </div>
  );
};

const Title: React.FC<{ scene: Of<"title"> }> = ({ scene }) => {
  const { u, vertical } = useLayout();
  const theme = useTheme();
  const line = useEnter(0.35);
  return (
    <Frame>
      {scene.kicker ? (
        <Rise>
          <div
            style={{
              fontSize: 34 * u,
              fontWeight: 600,
              letterSpacing: 6 * u,
              textTransform: "uppercase",
              color: theme.accent,
            }}
          >
            {scene.kicker}
          </div>
        </Rise>
      ) : null}
      <Rise delay={0.15}>
        <Heading size={vertical ? 118 : 128}>{scene.title}</Heading>
      </Rise>
      <div
        style={{
          width: 220 * u * line,
          height: 14 * u,
          borderRadius: 7 * u,
          background: theme.accent,
        }}
      />
    </Frame>
  );
};

const Text: React.FC<{ scene: Of<"text"> }> = ({ scene }) => {
  const { u } = useLayout();
  const theme = useTheme();
  return (
    <Frame>
      {scene.icon ? (
        <Pop>
          <Icon name={scene.icon} size={240 * u} />
        </Pop>
      ) : null}
      <Rise delay={0.15}>
        <Heading>{scene.heading}</Heading>
      </Rise>
      {scene.body ? (
        <Rise delay={0.4}>
          <div style={{ fontSize: 46 * u, fontWeight: 400, lineHeight: 1.35, color: theme.muted }}>
            {scene.body}
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
  const p = interpolate(frame, [0.2 * fps, 1.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const shown = (scene.value * p).toFixed(scene.decimals);
  return (
    <Frame>
      <Pop>
        <div
          style={{
            fontSize: 300 * u,
            fontWeight: 800,
            lineHeight: 1,
            color: theme.accent,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {scene.prefix}
          {shown}
          {scene.suffix}
        </div>
      </Pop>
      <Rise delay={0.5}>
        <div style={{ fontSize: 52 * u, fontWeight: 600, lineHeight: 1.3 }}>{scene.label}</div>
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
  const grow = useEnter(0.4 + index * 0.25, 20);
  const color = bar.color ?? theme.palette[index % theme.palette.length];
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 40 * u,
          fontWeight: 600,
          marginBottom: 12 * u,
        }}
      >
        <span>{bar.label}</span>
        <span style={{ color, opacity: grow }}>
          {bar.value}
          {unit}
        </span>
      </div>
      <div style={{ height: 56 * u, borderRadius: 28 * u, background: `${theme.text}1A` }}>
        <div
          style={{
            width: `${(bar.value / max) * 100 * grow}%`,
            height: "100%",
            borderRadius: 28 * u,
            background: color,
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
      <Rise>
        <Heading size={72}>{scene.heading}</Heading>
      </Rise>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 40 * u }}>
        {scene.bars.map((bar, i) => (
          <Bar key={bar.label} bar={bar} max={max} unit={scene.unit} index={i} />
        ))}
      </div>
    </Frame>
  );
};

const List: React.FC<{ scene: Of<"list"> }> = ({ scene }) => {
  const { u } = useLayout();
  const theme = useTheme();
  return (
    <Frame align="start">
      <Rise>
        <Heading size={72}>{scene.heading}</Heading>
      </Rise>
      {scene.items.map((item, i) => (
        <Rise key={item} delay={0.4 + i * 0.45}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 * u }}>
            <div
              style={{
                flexShrink: 0,
                width: 76 * u,
                height: 76 * u,
                borderRadius: 22 * u,
                background: theme.palette[i % theme.palette.length],
                color: theme.bg,
                fontSize: 40 * u,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 46 * u, fontWeight: 600, lineHeight: 1.25 }}>{item}</div>
          </div>
        </Rise>
      ))}
    </Frame>
  );
};

const Outro: React.FC<{ scene: Of<"outro"> }> = ({ scene }) => {
  const { u } = useLayout();
  const theme = useTheme();
  return (
    <Frame>
      <Pop>
        <Icon name="spark" size={160 * u} />
      </Pop>
      <Rise delay={0.15}>
        <Heading>{scene.title}</Heading>
      </Rise>
      <Pop delay={0.5}>
        <div
          style={{
            fontSize: 44 * u,
            fontWeight: 800,
            padding: `${24 * u}px ${56 * u}px`,
            borderRadius: 999,
            background: theme.accent,
            color: theme.bg,
          }}
        >
          {scene.cta}
        </div>
      </Pop>
    </Frame>
  );
};

export const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.type) {
    case "title":
      return <Title scene={scene} />;
    case "text":
      return <Text scene={scene} />;
    case "stat":
      return <Stat scene={scene} />;
    case "bars":
      return <Bars scene={scene} />;
    case "list":
      return <List scene={scene} />;
    case "outro":
      return <Outro scene={scene} />;
  }
};
