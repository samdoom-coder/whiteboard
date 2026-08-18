import type { Theme } from "../types";

export interface ThemePalette {
  name: Theme;
  canvasBackground: string;
  canvasBackgroundDark: string; // behind (outside infinite canvas there's no real bg, but for exports)
  grid: string;
  gridLines: string;
  dot: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  shadow: string;
  danger: string;
  stroke: string;
  strokeSecondary: string;
  selection: string;
  selectionFill: string;
  selectionBorder: string;
  transparent: string;
}

export const palettes: Record<Theme, ThemePalette> = {
  light: {
    name: "light",
    canvasBackground: "#faf9f5",
    canvasBackgroundDark: "#efece4",
    grid: "rgba(0,0,0,0.06)",
    gridLines: "rgba(0,0,0,0.04)",
    dot: "rgba(0,0,0,0.10)",
    surface: "#ffffff",
    surfaceHover: "#f5f4f0",
    surfaceActive: "#ecebe6",
    border: "rgba(0,0,0,0.10)",
    borderStrong: "rgba(0,0,0,0.20)",
    text: "#1c1b1a",
    textMuted: "#6f6d69",
    accent: "#5b6ee1",
    accentHover: "#4c5fd0",
    accentSoft: "rgba(91,110,225,0.12)",
    shadow: "0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
    danger: "#e05c5c",
    stroke: "#2b2a29",
    strokeSecondary: "#8a8a86",
    selection: "#5b6ee1",
    selectionFill: "rgba(91,110,225,0.10)",
    selectionBorder: "rgba(91,110,225,0.55)",
    transparent: "#ffffff",
  },
  dark: {
    name: "dark",
    canvasBackground: "#1c1b1a",
    canvasBackgroundDark: "#151414",
    grid: "rgba(255,255,255,0.06)",
    gridLines: "rgba(255,255,255,0.04)",
    dot: "rgba(255,255,255,0.12)",
    surface: "#262524",
    surfaceHover: "#2e2d2b",
    surfaceActive: "#353433",
    border: "rgba(255,255,255,0.10)",
    borderStrong: "rgba(255,255,255,0.22)",
    text: "#eceae6",
    textMuted: "#9a9892",
    accent: "#8f9fff",
    accentHover: "#a2b0ff",
    accentSoft: "rgba(143,159,255,0.14)",
    shadow: "0 8px 30px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)",
    danger: "#ff7676",
    stroke: "#dcdad6",
    strokeSecondary: "#8f8d89",
    selection: "#8f9fff",
    selectionFill: "rgba(143,159,255,0.14)",
    selectionBorder: "rgba(143,159,255,0.6)",
    transparent: "#1c1b1a",
  },
};

/** True when a hex color is perceived as dark (low luminance). */
export const isDarkColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
};

/** Foreground color that stays readable on a given background. */
export const contrastingColor = (bg: string, dark: string, light: string): string =>
  isDarkColor(bg) ? dark : light;

export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const mix = (c1: string, c2: string, t: number): string => {
  const ar = parseInt(c1.slice(1, 3), 16);
  const ag = parseInt(c1.slice(3, 5), 16);
  const ab = parseInt(c1.slice(5, 7), 16);
  const br = parseInt(c2.slice(1, 3), 16);
  const bg = parseInt(c2.slice(3, 5), 16);
  const bb = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${b})`;
};

/** Lighten (amt > 0) or darken (amt < 0) a hex color. Falls back to the input if not hex. */
export const shade = (hex: string, amt: number): string => {
  if (!hex || hex[0] !== "#" || hex.length < 7) return hex;
  const step = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
  const r = step(parseInt(hex.slice(1, 3), 16));
  const g = step(parseInt(hex.slice(3, 5), 16));
  const b = step(parseInt(hex.slice(5, 7), 16));
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgb(${r},${g},${b})`;
};

/** Curated hand-picked palette for fills/strokes. */
export const elementColors = {
  strokes: [
    "#1e1e1e",
    "#e03131",
    "#e8590c",
    "#f08c00",
    "#2b8a3e",
    "#0c8599",
    "#1971c2",
    "#5f3dc4",
    "#a61e4d",
    "#7048e8",
    "#6a6a68",
    "#ffffff",
  ],
  fills: [
    "transparent",
    "#ffc9c9",
    "#ffd8a8",
    "#ffec99",
    "#b2f2bb",
    "#99e9f2",
    "#a5d8ff",
    "#d0bfff",
    "#ffc2e6",
    "#e6e6e6",
    "#ffffff",
    "#333333",
  ],
};