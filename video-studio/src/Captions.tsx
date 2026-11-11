import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY, useLayout, useTheme } from "./theme";

export type CaptionWord = { text: string; start: number; end: number };

const MAX_WORDS = 4;
const MAX_CHARS = 22;
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
 * Words turn white as they are spoken; numbers are picked out in the accent colour.
 */
export const Captions: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
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
            const color = !spoken ? theme.pillMuted : /\d/.test(word.text) ? theme.accent : theme.pillText;
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
