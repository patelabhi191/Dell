import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, useLayout, useTheme } from "./theme";

export type CaptionWord = { text: string; start: number; end: number };

const MAX_WORDS = 4;
const MAX_CHARS = 22;
const HOLD = 0.6; // seconds a phrase lingers after its last word

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

/** Word-by-word captions from Whisper timings (captions/<id>.json). */
export const Captions: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, safe } = useLayout();
  const theme = useTheme();
  const phrases = useMemo(() => toPhrases(words), [words]);
  const t = frame / fps;

  const index = phrases.findIndex((p, i) => {
    const next = phrases[i + 1]?.[0].start ?? Infinity;
    return t >= p[0].start && t < Math.min(next, p[p.length - 1].end + HOLD);
  });
  if (index === -1) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        right: safe.side,
        bottom: vertical ? safe.bottom - 130 * u : 50 * u,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: (vertical ? 50 : 42) * u,
          fontWeight: 800,
          lineHeight: 1.2,
          textAlign: "center",
          padding: `${14 * u}px ${30 * u}px`,
          borderRadius: 22 * u,
          background: `${theme.bg}E6`,
          color: theme.text,
        }}
      >
        {phrases[index].map((word, i) => (
          <span key={i} style={{ color: t >= word.start ? theme.accent : theme.text }}>
            {word.text}{" "}
          </span>
        ))}
      </div>
    </div>
  );
};
