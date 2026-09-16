import { create } from "zustand";

const KEY = "whiteboard:eraser-size";
export const ERASER_MIN = 2;
export const ERASER_MAX = 40;

const load = (): number => {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (Number.isFinite(v)) return Math.min(ERASER_MAX, Math.max(ERASER_MIN, v));
  } catch {
    /* ignore */
  }
  return 10;
};

interface EraserState {
  /** brush radius in screen px (divided by zoom at use time) */
  size: number;
  setSize: (n: number) => void;
}

export const useEraser = create<EraserState>()((set) => ({
  size: load(),
  setSize: (n) => {
    const size = Math.min(ERASER_MAX, Math.max(ERASER_MIN, Math.round(n)));
    set({ size });
    try {
      localStorage.setItem(KEY, String(size));
    } catch {
      /* ignore */
    }
  },
}));
