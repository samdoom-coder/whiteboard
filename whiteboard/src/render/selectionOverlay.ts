import type { Element, Theme } from "../types";
import { palettes } from "../util/color";
import { dist } from "../util/math";
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
  // draw in screen space
  const pts = visual.box.points.map((q) => toScreen(q, view));

  // selection fill
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.selectionBorder;
  ctx.lineWidth = 1.2;
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
  const size = 8 / Math.max(0.1, zoom);
  const drawHandle = (x: number, y: number, cursor: string) => {
    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 2, size, size);
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = p.selectionBorder;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    void cursor;
  };
  for (const h of Object.values(visual.handles)) {
    const s = toScreen(h, view);
    drawHandle(s.x, s.y, "resize");
  }

  // rotate handle
  const rs = toScreen(visual.rotatePos, view);
  ctx.beginPath();
  ctx.arc(rs.x, rs.y, 5.5 / Math.max(0.1, zoom), 0, Math.PI * 2);
  ctx.fillStyle = p.surface;
  ctx.fill();
  ctx.strokeStyle = p.selectionBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // line connecting rotate handle to box
  const north = {
    x: (pts[0].x + pts[1].x) / 2,
    y: (pts[0].y + pts[1].y) / 2,
  };
  ctx.beginPath();
  ctx.moveTo(north.x, north.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.strokeStyle = p.selectionBorder;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
};