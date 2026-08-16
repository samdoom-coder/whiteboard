import type { ViewState } from "../types";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export const screenToWorld = (
  sx: number,
  sy: number,
  view: ViewState,
) => ({
  x: (sx - view.scrollX) / view.zoom,
  y: (sy - view.scrollY) / view.zoom,
});

export const worldToScreen = (
  wx: number,
  wy: number,
  view: ViewState,
) => ({
  x: wx * view.zoom + view.scrollX,
  y: wy * view.zoom + view.scrollY,
});

export const clampZoom = (z: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const zoomAtScreen = (
  view: ViewState,
  sx: number,
  sy: number,
  factor: number,
): ViewState => {
  const zoom = clampZoom(view.zoom * factor);
  const world = screenToWorld(sx, sy, view);
  return {
    zoom,
    scrollX: sx - world.x * zoom,
    scrollY: sy - world.y * zoom,
  };
};

export const panBy = (view: ViewState, dx: number, dy: number): ViewState => ({
  ...view,
  scrollX: view.scrollX + dx,
  scrollY: view.scrollY + dy,
});

export const centerOn = (view: ViewState, wx: number, wy: number): ViewState => ({
  ...view,
  scrollX: wx - view.scrollX,
  scrollY: wy - view.scrollY,
});

export const fitViewport = (
  view: ViewState,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  vw: number,
  vh: number,
  padding = 80,
): ViewState => {
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  if (!isFinite(bw) || bw <= 0 || !isFinite(bh) || bh <= 0) {
    return { ...view, zoom: 1, scrollX: 0, scrollY: 0 };
  }
  const zoom = clampZoom(
    Math.min((vw - padding * 2) / bw, (vh - padding * 2) / bh, 1.4),
  );
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    scrollX: vw / 2 - cx * zoom,
    scrollY: vh / 2 - cy * zoom,
  };
};

export const zoomOnElement = (
  view: ViewState,
  elBounds: { minX: number; minY: number; maxX: number; maxY: number },
  vw: number,
  vh: number,
): ViewState => fitViewport(view, elBounds, vw, vh, 40);

export const clampZoomFactor = (z: number) => clampZoom(z);