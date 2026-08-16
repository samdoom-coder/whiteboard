export interface FontOption {
  id: string;
  label: string;
  family: string;
}

/** Curated "cool" fonts using broadly-available system stacks (no network needed). */
export const textFonts: FontOption[] = [
  { id: "sans", label: "Sans", family: "'Inter', system-ui, -apple-system, sans-serif" },
  { id: "comic", label: "Comic", family: "'Comic Sans MS', 'Comic Neue', 'Chalkboard SE', cursive" },
  { id: "hand", label: "Hand", family: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive" },
  { id: "brush", label: "Brush", family: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive" },
  { id: "mono", label: "Mono", family: "'Courier New', Courier, monospace" },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "display", label: "Impact", family: "Impact, Haettenschweiler, 'Arial Black', sans-serif" },
  { id: "title", label: "Trebuchet", family: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { id: "rounded", label: "Rounded", family: "'Verdana', 'DejaVu Sans', sans-serif" },
  { id: "letter", label: "Letters", family: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
];

export const defaultFontFamily = textFonts[0].family;

export const fontSizes = [14, 16, 18, 20, 24, 28, 32, 40, 48, 64];