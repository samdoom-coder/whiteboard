import type { CanvasEngine } from "./engine";

let engine: CanvasEngine | null = null;

export const setEngine = (e: CanvasEngine) => {
  engine = e;
};

export const clearEngine = () => {
  engine = null;
};

export const getEngine = (): CanvasEngine => {
  if (!engine) throw new Error("Engine not initialized");
  return engine;
};