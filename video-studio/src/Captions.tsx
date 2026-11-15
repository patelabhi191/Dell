import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY, useLayout, useTheme } from "./theme";

export type CaptionWord = { text: string; start: number; end: number };

// 1-3 words at a time: the benchmark reel flashes short bursts, which keeps eyes moving.
const MAX_WORDS = 3;
const MAX_CHARS = 20;
const HOLD = 0.5; // seconds a phrase lingers after its last word

/** Short phrases that break at punctuation, so one thought is on screen at a time. */
const toPhrases = (words: CaptionWord[]) => {
  const phrases: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  for (const word of words) {
    const chars = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
    if (current.length && (current.length >= MAX_WORDS || chars > MAX_CHARS)) {
      phrases.push(current);
      current = [];
    }
    current.push(word);
    if (/[.!?,;:]$/.test(word.text)) {
      phrases.push(current);
      current = [];
    }
  }
  if (current.length) phrases.push(current);
  return phrases;
};

/**
 * Caption pill under the stage, from Whisper timings (captions/<id>.json).
 * Words turn white as they are spoken; numbers and the episode's keywords are cyan throughout,
 * so the point still lands with the sound off.
 */
export const Captions: React.FC<{ words: CaptionWord[]; keywords?: string[]; variant?: "pill" | "top" | "box" }> = ({
  words,
  keywords = [],
  variant = "pill",
}) => {
  const keys = useMemo(() => new Set(keywords.map((k) => k.toLowerCase())), [keywords]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, captionCenter, side } = useLayout();
  const theme = useTheme();
  const phrases = useMemo(() => toPhrases(words), [words]);
  const t = frame / fps;

  const index = phrases.findIndex((p, i) => {
    const next = phrases[i + 1]?.[0].start ?? Infinity;
    return t >= p[0].start - 0.05 && t < Math.min(next - 0.05, p[p.length - 1].end + HOLD);
  });
  if (index === -1) return null;
  const size = (vertical ? 50 : 40) * u;
  if (variant === "box") {
    // Reference style: white words in a dark box with a cyan border, key words in cyan,
    // sitting low in the frame but above the platform's caption area.
    const boxSize = (vertical ? 48 : 38) * u;
    const popBox = spring({ frame: frame - phrases[index][0].start * fps, fps, config: { damping: 12, mass: 0.5 } });
    return (
      <div style={{ position: "absolute", left: side, right: side, top: (vertical ? 1330 : 960) * u, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: BODY,
            fontSize: boxSize,
            fontWeight: 900,
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            padding: `${boxSize * 0.28}px ${boxSize * 0.5}px`,
            background: "rgba(8,12,24,0.92)",
            border: `${3 * u}px solid #2ED3FF`,
            borderRadius: 6 * u,
            boxShadow: `0 0 ${18 * u}px rgba(46,211,255,0.35)`,
            transform: `scale(${0.9 + 0.1 * popBox})`,
          }}
        >
          {phrases[index].map((word, i) => {
            const bare = word.text.toLowerCase().replace(/[^a-z0-9']/g, "");
            const key = /\d/.test(word.text) || keys.has(bare) || keys.has(bare.replace(/'?s$/, ""));
            const spoken = t >= word.start - 0.05;
            return (
              <span key={i} style={{ color: key && spoken ? "#2ED3FF" : spoken ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}>
                {word.text}
                {i < phrases[index].length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  if (variant === "top") {
    // Benchmark style: small white words near the top, key words in a filled yellow box.
    const topSize = (vertical ? 46 : 38) * u;
    const popTop = spring({ frame: frame - phrases[index][0].start * fps, fps, config: { damping: 12, mass: 0.5 } });
    return (
      <div style={{ position: "absolute", left: side, right: side, top: (vertical ? 300 : 60) * u, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: BODY,
            fontSize: topSize,
            fontWeight: 900,
            lineHeight: 1.25,
            textAlign: "center",
            color: "#FFFFFF",
            textShadow: `0 ${3 * u}px ${12 * u}px rgba(0,0,0,0.85)`,
            transform: `scale(${0.9 + 0.1 * popTop})`,
            maxWidth: 760 * u,
          }}
        >
          {phrases[index].map((word, i) => {
            const bare = word.text.toLowerCase().replace(/[^a-z0-9']/g, "");
            const key = /\d/.test(word.text) || keys.has(bare) || keys.has(bare.replace(/'?s$/, ""));
            const spoken = t >= word.start - 0.05;
            return (
              <span key={i} style={{ whiteSpace: "pre" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: key ? `0 ${8 * u}px` : 0,
                    borderRadius: 8 * u,
                    background: key && spoken ? theme.captionHighlight : "transparent",
                    color: key && spoken ? "#111111" : spoken ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                    textShadow: key && spoken ? "none" : undefined,
                  }}
                >
                  {word.text}
                </span>
                {i < phrases[index].length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  // Each new phrase pops in; the word being spoken lifts slightly.
  const pop = spring({ frame: frame - phrases[index][0].start * fps, fps, config: { damping: 11, mass: 0.5 } });

  return (
    <div
      style={{
        position: "absolute",
        left: side,
        right: side,
        top: captionCenter - size,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: size * 0.3,
          fontFamily: BODY,
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1,
          whiteSpace: "nowrap",
          padding: `${size * 0.36}px ${size * 0.5}px`,
          borderRadius: size * 0.28,
          background: theme.pill,
          border: `${2 * u}px solid ${theme.pillBorder}`,
          boxShadow: `0 ${6 * u}px ${18 * u}px ${theme.shadow}`,
          transform: `scale(${0.86 + 0.14 * pop})`,
        }}
      >
        <span
          style={{
            width: size * 0.22,
            height: size * 0.22,
            background: theme.accent,
            transform: "rotate(45deg)",
            flexShrink: 0,
          }}
        />
        <span>
          {phrases[index].map((word, i) => {
            const spoken = t >= word.start - 0.05;
            const bare = word.text.toLowerCase().replace(/[^a-z0-9']/g, "");
            const key = /\d/.test(word.text) || keys.has(bare) || keys.has(bare.replace(/'?s$/, ""));
            const color = key ? theme.captionHighlight : spoken ? theme.pillText : theme.pillMuted;
            return (
              <span
                key={i}
                style={{
                  color,
                  display: "inline-block",
                  whiteSpace: "pre",
                  transform: spoken && t < word.end + 0.08 ? `translateY(${-0.09 * size}px)` : undefined,
                }}
              >
                {word.text}
                {i < phrases[index].length - 1 ? " " : ""}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
};
