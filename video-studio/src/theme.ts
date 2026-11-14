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
  /** Key words in the captions. Cyan reads better than the accent on the dark pill. */
  captionHighlight: string;
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
    captionHighlight: "#3DDCFF",
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
    captionHighlight: "#3DDCFF",
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
 * Screen zones for 9:16, measured against the Instagram Reels interface on a notched phone:
 *  - top 14% is covered by the status bar / Dynamic Island and the "Reels" header;
 *  - bottom 22% is covered by the username, caption and audio row;
 *  - the right edge carries the like/comment/share buttons from about 55% down;
 *  - tall phones crop roughly 5% off each side.
 * So: nothing above 270, nothing below 1500, and nothing right of 890 in the lower half
 * (all in 1080x1920 units). `u` is one design unit (1/1080 of the short edge).
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  if (vertical) {
    const scale = 0.82 * u;
    return {
      vertical, u, width, height,
      side: 110 * u,
      headingTop: 290 * u,
      stage: { x: 110 * u, y: 450 * u, scale },
      horizon: 1010 * u,
      contentTop: 290 * u,
      contentBottom: 1250 * u,
      captionCenter: 1335 * u,
    };
  }
  const scale = 0.8 * u;
  return {
    vertical, u, width, height,
    side: 90 * u,
    headingTop: 70 * u,
    stage: { x: (width - STAGE.width * scale) / 2, y: 210 * u, scale },
    horizon: 740 * u,
    contentTop: 80 * u,
    contentBottom: 940 * u,
    captionCenter: 1000 * u,
  };
};
