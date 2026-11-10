import React from "react";
import { useTheme } from "./theme";
import type { IconName } from "./types";

/**
 * Flat icons on a 100x100 grid. To add one: add its name to `iconNames` in types.ts
 * and a case below. `a` = accent colour, `b` = secondary, `d` = dark detail.
 */
export const Icon: React.FC<{ name: IconName; size: number }> = ({ name, size }) => {
  const theme = useTheme();
  const a = theme.accent;
  const b = theme.palette[1];
  const d = theme.bg;

  const art: Record<IconName, React.ReactNode> = {
    sun: (
      <>
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={46}
            y={4}
            width={8}
            height={18}
            rx={4}
            fill={a}
            transform={`rotate(${i * 45} 50 50)`}
          />
        ))}
        <circle cx={50} cy={50} r={24} fill={a} />
      </>
    ),
    eye: (
      <>
        <path d="M5 50 Q50 5 95 50 Q50 95 5 50Z" fill={theme.text} />
        <circle cx={50} cy={50} r={20} fill={b} />
        <circle cx={50} cy={50} r={9} fill={d} />
      </>
    ),
    bulb: (
      <>
        <circle cx={50} cy={40} r={30} fill={a} />
        <rect x={36} y={66} width={28} height={10} rx={3} fill={theme.muted} />
        <rect x={40} y={80} width={20} height={8} rx={4} fill={theme.muted} />
      </>
    ),
    wave: (
      <>
        <path
          d="M5 35 Q20 10 35 35 T65 35 T95 35"
          fill="none"
          stroke={b}
          strokeWidth={8}
          strokeLinecap="round"
        />
        <path
          d="M5 70 Q27.5 40 50 70 T95 70"
          fill="none"
          stroke={theme.palette[2]}
          strokeWidth={8}
          strokeLinecap="round"
        />
      </>
    ),
    globe: (
      <>
        <circle cx={50} cy={50} r={42} fill={b} />
        <path d="M22 34 q14 -12 26 0 q6 14 -8 20 q-16 4 -18 -20Z" fill={theme.palette[3]} />
        <path d="M58 54 q16 -6 22 8 q-4 16 -18 14 q-10 -8 -4 -22Z" fill={theme.palette[3]} />
      </>
    ),
    clock: (
      <>
        <circle cx={50} cy={50} r={42} fill={theme.text} />
        <rect x={46} y={22} width={8} height={32} rx={4} fill={d} />
        <rect x={46} y={46} width={26} height={8} rx={4} fill={theme.palette[2]} />
      </>
    ),
    spark: (
      <path
        d="M50 4 L60 40 L96 50 L60 60 L50 96 L40 60 L4 50 L40 40Z"
        fill={a}
      />
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {art[name]}
    </svg>
  );
};
