import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";

export type Theme = {
  name: "light" | "night";
  bg: string;
  bgEdge: string;
  grid: string;
  ink: string;
  muted: string;
  accent: string;
  /** Darker accent: side faces, and the hard shadow under accent-coloured headline words. */
  accentDeep: string;
  /** Text colour on top of the accent. */
  onAccent: string;
  alert: string;
  /** Neutral object colour (buildings, figures) with its darker and lighter faces. */
  slate: string;
  slateDark: string;
  slateLight: string;
  /** Tags and the caption pill. */
  pill: string;
  pillText: string;
  pillMuted: string;
  pillBorder: string;
  card: string;
  shadow: string;
  /** Extra colours for bars and badges. */
  palette: string[];
};

/** The channel look: white stage by default, black "night mode" for stories. */
export const themes: Record<Theme["name"], Theme> = {
  light: {
    name: "light",
    bg: "#F2F0EC",
    bgEdge: "#DDDBD3",
    grid: "rgba(20,20,20,0.075)",
    ink: "#141414",
    muted: "#6F6D67",
    accent: "#2563FF",
    accentDeep: "#1741B8",
    onAccent: "#FFFFFF",
    alert: "#F04E23",
    slate: "#878796",
    slateDark: "#6A6A78",
    slateLight: "#A9A9B6",
    pill: "#17181C",
    pillText: "#FFFFFF",
    pillMuted: "#85868C",
    pillBorder: "transparent",
    card: "#FFFFFF",
    shadow: "rgba(20,20,20,0.16)",
    palette: ["#2563FF", "#F5B700", "#F04E23", "#878796", "#141414"],
  },
  night: {
    name: "night",
    bg: "#0C0D10",
    bgEdge: "#040405",
    grid: "rgba(255,255,255,0.06)",
    ink: "#F4F3EE",
    muted: "#8E8F98",
    accent: "#4D8DFF",
    accentDeep: "#2452B8",
    onAccent: "#FFFFFF",
    alert: "#FF5A36",
    slate: "#6B6D7C",
    slateDark: "#4C4E5B",
    slateLight: "#8A8C9B",
    pill: "#1D1F26",
    pillText: "#FFFFFF",
    pillMuted: "#74767F",
    pillBorder: "rgba(255,255,255,0.16)",
    card: "#17191F",
    shadow: "rgba(0,0,0,0.5)",
    palette: ["#4D8DFF", "#F5B700", "#FF5A36", "#8A8C9B", "#F4F3EE"],
  },
};

export const ThemeContext = createContext<Theme>(themes.light);
export const useTheme = () => useContext(ThemeContext);

/** Chunky headline face and a rounded bold for everything else. */
export const DISPLAY = '"Passion One", Impact, sans-serif';
export const BODY = "Nunito, system-ui, sans-serif";

/** The stage is authored on this fixed canvas; the framework scales it into place. */
export const STAGE = { width: 1000, height: 900, ground: 830 };

/**
 * Screen zones, matched to the reference: tracker at the very top, headline under it,
 * stage in the middle, captions under the stage, bottom of the frame left empty for
 * the platform's own buttons. `u` is one design unit (1/1080 of the short edge).
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  if (vertical) {
    return {
      vertical, u, width, height,
      side: 64 * u,
      progressTop: 76 * u,
      headingTop: 196 * u,
      stage: { x: 40 * u, y: 430 * u, scale: u },
      horizon: 1060 * u,
      contentTop: 190 * u,
      contentBottom: 1400 * u,
      captionCenter: 1470 * u,
    };
  }
  const scale = 0.8 * u;
  return {
    vertical, u, width, height,
    side: 90 * u,
    progressTop: 36 * u,
    headingTop: 132 * u,
    stage: { x: (width - STAGE.width * scale) / 2, y: 236 * u, scale },
    horizon: 760 * u,
    contentTop: 130 * u,
    contentBottom: 940 * u,
    captionCenter: 1000 * u,
  };
};
