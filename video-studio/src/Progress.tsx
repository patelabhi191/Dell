import React from "react";
import { BODY, useLayout, useTheme } from "./theme";

/** Step tracker at the top of the frame: one pill per step, from text like "STEP 2/4". */
export const Progress: React.FC<{ value: string; opacity: number }> = ({ value, opacity }) => {
  const { u, progressTop } = useLayout();
  const theme = useTheme();
  const match = value.match(/(\d+)\/(\d+)$/);
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  return (
    <div
      style={{
        position: "absolute",
        top: progressTop,
        left: 0,
        right: 0,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16 * u,
      }}
    >
      <div style={{ display: "flex", gap: 12 * u }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: 120 * u,
              height: 12 * u,
              borderRadius: 6 * u,
              background: i + 1 === current ? theme.accent : i + 1 < current ? theme.ink : theme.grid,
              border: i + 1 === current ? `${2 * u}px solid ${theme.accentDeep}` : "none",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: 30 * u,
          letterSpacing: 1 * u,
          color: theme.ink,
          textTransform: "uppercase",
        }}
      >
        {value}
      </div>
    </div>
  );
};
