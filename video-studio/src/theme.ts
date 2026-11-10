import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";

export type Theme = {
  bg: string;
  bgAlt: string;
  text: string;
  muted: string;
  accent: string;
  /** Palette cycled through for bars, bullets and background shapes. */
  palette: string[];
};

/** Add a channel look here, then reference it by name in an episode's "theme". */
export const themes: Record<string, Theme> = {
  midnight: {
    bg: "#14162B",
    bgAlt: "#1E2142",
    text: "#F6F4EC",
    muted: "#A9ADCB",
    accent: "#FFC857",
    palette: ["#FFC857", "#4CC9F0", "#F2545B", "#7BD389", "#B388EB"],
  },
  paper: {
    bg: "#F5EFE3",
    bgAlt: "#EADFCB",
    text: "#1F2233",
    muted: "#6A6E85",
    accent: "#E4572E",
    palette: ["#E4572E", "#2E86AB", "#F2B134", "#3BA774", "#7A5CC2"],
  },
};

export const ThemeContext = createContext<Theme>(themes.midnight);
export const useTheme = () => useContext(ThemeContext);

export const FONT = "Poppins, system-ui, sans-serif";

/**
 * Sizing that works for both 9:16 and 16:9.
 * `u` is one design unit (1/1080 of the short edge), so sizes written as `40 * u`
 * look the same in both formats.
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return {
    vertical,
    u,
    width,
    height,
    // Reels / Shorts UI covers the top and (mostly) the bottom of the frame.
    safe: vertical
      ? { top: 220 * u, bottom: 420 * u, side: 90 * u }
      : { top: 90 * u, bottom: 90 * u, side: 150 * u },
  };
};
