import type { Element, LineElement, Point, Theme } from "../types";
import { palettes, type ThemePalette } from "../util/color";
import { dist } from "../util/math";
import { localToWorld } from "./geometry";
import {
  handlePositions,
  rotateHandlePos,
  selectionBox,
  type ResizeHandle,
} from "./resize";

export interface SelectionVisual {
  box: ReturnType<typeof selectionBox>;
  handles: Record<Exclude<ResizeHandle, "rotate">, { x: number; y: number }>;
  rotatePos: { x: number; y: number };
  angle: number;
  center: { x: number; y: number };
}

export const computeSelectionVisual = (
  elements: Element[],
): SelectionVisual => {
  const box = selectionBox(elements);
  const handles = handlePositions(box);
  const rotatePos = rotateHandlePos(box);
  return { box, handles, rotatePos, angle: box.angle, center: box.center };
};

const toScreen = (
  p: { x: number; y: number },
  view: { scrollX: number; scrollY: number; zoom: number },
) => ({ x: p.x * view.zoom + view.scrollX, y: p.y * view.zoom + view.scrollY });

export const hitTestHandle = (
  visual: SelectionVisual,
  screenPoint: { x: number; y: number },
  view: { scrollX: number; scrollY: number; zoom: number },
): ResizeHandle | null => {
  const rp = toScreen(visual.rotatePos, view);
  if (dist(screenPoint.x, screenPoint.y, rp.x, rp.y) <= 14) {
    return "rotate";
  }
  const tol = 10 / Math.max(0.1, view.zoom);
  for (const h of Object.keys(visual.handles) as Exclude<ResizeHandle, "rotate">[]) {
    const p = toScreen(visual.handles[h], view);
    if (dist(screenPoint.x, screenPoint.y, p.x, p.y) <= tol) {
      return h;
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* line / arrow point (curve) editing                                  */
/* ------------------------------------------------------------------ */

/** World-space positions of a line/arrow's control points. */
export const linePointWorlds = (line: LineElement): Point[] =>
  line.points.map((p) => localToWorld(line, p));

/** World-space midpoints between consecutive segments (where new curve points are added). */
export const lineMidpoints = (line: LineElement): Array<{ world: Point; seg: number }> => {
  const pts = linePointWorlds(line);
  const mids: Array<{ world: Point; seg: number }> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    mids.push({
      world: { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 },
      seg: i,
    });
  }
  return mids;
};

/** Returns the index of a control point near the screen point, or null. */
export const hitTestLinePoint = (
  line: LineElement,
  screenPoint: { x: number; y: number },
  view: { scrollX: number; scrollY: number; zoom: number },
): number | null => {
  const tol = 12 / Math.max(0.1, view.zoom);
  const pts = linePointWorlds(line);
  let best: number | null = null;
  let bestD = tol;
  for (let i = 0; i < pts.length; i++) {
    const s = toScreen(pts[i], view);
    const d = dist(screenPoint.x, screenPoint.y, s.x, s.y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};

/** Returns the segment index whose midpoint is near the screen point, or null. */
export const hitTestLineMidpoint = (
  line: LineElement,
  screenPoint: { x: number; y: number },
  view: { scrollX: number; scrollY: number; zoom: number },
): number | null => {
  const tol = 14 / Math.max(0.1, view.zoom);
  for (const m of lineMidpoints(line)) {
    const s = toScreen(m.world, view);
    if (dist(screenPoint.x, screenPoint.y, s.x, s.y) <= tol) return m.seg;
  }
  return null;
};

/** Insert a midpoint into the segment `seg` so it can be dragged into a curve. */
export const insertLinePoint = (line: LineElement, seg: number): LineElement => {
  const pts = line.points.slice();
  const a = pts[seg];
  const b = pts[seg + 1];
  pts.splice(seg + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return { ...line, points: pts };
};

const drawLineEditOverlay = (
  ctx: CanvasRenderingContext2D,
  line: LineElement,
  view: { scrollX: number; scrollY: number; zoom: number },
  p: ThemePalette,
) => {
  const { zoom } = view;
  const pts = linePointWorlds(line).map((q) => toScreen(q, view));

  // highlight the path itself
  ctx.strokeStyle = p.selection;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // midpoint handles (dashed circles) — drag to add a curve point
  const mSize = 5 / Math.max(0.1, zoom);
  for (const m of lineMidpoints(line)) {
    const s = toScreen(m.world, view);
    ctx.beginPath();
    ctx.arc(s.x, s.y, mSize, 0, Math.PI * 2);
    ctx.strokeStyle = p.selection;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3 / Math.max(0.1, zoom), 3 / Math.max(0.1, zoom)]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.selectionFill;
    ctx.fill();
  }

  // vertex handles
  const size = 9 / Math.max(0.1, zoom);
  for (const s of pts) {
    ctx.beginPath();
    ctx.rect(s.x - size / 2, s.y - size / 2, size, size);
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = p.selection;
    ctx.lineWidth = 1.8;
    ctx.fill();
    ctx.stroke();
  }

  // rotate handle (kept so lines can still be rotated)
  const visual = computeSelectionVisual([line]);
  const rs = toScreen(visual.rotatePos, view);
  ctx.beginPath();
  ctx.arc(rs.x, rs.y, 6 / Math.max(0.1, zoom), 0, Math.PI * 2);
  ctx.fillStyle = p.surface;
  ctx.fill();
  ctx.strokeStyle = p.selection;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  const boxPts = visual.box.points.map((q) => toScreen(q, view));
  const north = {
    x: (boxPts[0].x + boxPts[1].x) / 2,
    y: (boxPts[0].y + boxPts[1].y) / 2,
  };
  ctx.beginPath();
  ctx.moveTo(north.x, north.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.strokeStyle = p.selection;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
};

export const drawSelectionOverlay = (
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  view: { scrollX: number; scrollY: number; zoom: number },
  theme: Theme,
) => {
  if (!elements.length) return;
  const p = palettes[theme];
  const visual = computeSelectionVisual(elements);
  const { zoom } = view;

  ctx.save();

  const singleLine =
    elements.length === 1 && (elements[0].type === "line" || elements[0].type === "arrow")
      ? (elements[0] as LineElement)
      : null;

  if (singleLine) {
    drawLineEditOverlay(ctx, singleLine, view, p);
    ctx.restore();
    return;
  }

  // per-element highlight outline
  ctx.strokeStyle = p.selectionBorder;
  ctx.lineWidth = 1.5 / Math.max(0.1, zoom);
  ctx.setLineDash([5 / Math.max(0.1, zoom), 4 / Math.max(0.1, zoom)]);
  for (const el of elements) {
    const a = toScreen({ x: el.x, y: el.y }, view);
    const b = toScreen({ x: el.x + el.width, y: el.y + el.height }, view);
    ctx.beginPath();
    ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // draw in screen space
  const pts = visual.box.points.map((q) => toScreen(q, view));

  // selection fill
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.selection;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  // bounding box
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();

  // subtle fill
  ctx.fillStyle = p.selectionFill;
  ctx.fill();

  // handles
  const size = 9 / Math.max(0.1, zoom);
  const drawHandle = (x: number, y: number) => {
    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 2, size, size);
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = p.selection;
    ctx.lineWidth = 1.8;
    ctx.fill();
    ctx.stroke();
  };
  for (const h of Object.values(visual.handles)) {
    const s = toScreen(h, view);
    drawHandle(s.x, s.y);
  }

  // rotate handle
  const rs = toScreen(visual.rotatePos, view);
  ctx.beginPath();
  ctx.arc(rs.x, rs.y, 6 / Math.max(0.1, zoom), 0, Math.PI * 2);
  ctx.fillStyle = p.surface;
  ctx.fill();
  ctx.strokeStyle = p.selection;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // line connecting rotate handle to box
  const north = {
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  };
  ctx.beginPath();
  ctx.moveTo(north.x, north.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.strokeStyle = p.selection;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
};