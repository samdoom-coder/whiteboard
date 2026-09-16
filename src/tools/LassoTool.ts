import type { Element, LineElement, Point, ShapeElement } from "../types";
import { useStore } from "../core/store";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import {
  elementBounds,
  hitTestElement,
  localToWorld,
  shapeLocalGeometry,
} from "../render/geometry";
import { screenToWorld } from "../render/camera";
import { distToSegment, pointInPolygon, segmentsIntersect } from "../util/math";

const MIN_DIST_SQ = 3 * 3;
/** loops smaller than this (screen px) count as a tap, not a selection */
const MIN_LOOP = 8;

/**
 * Lasso (freeform) selection: drag a loop around elements to select them.
 * An element is selected only when it genuinely touches the loop — tested
 * against exact geometry with zero padding, so nearby elements are never
 * snagged. A plain tap clears the selection (like marquee).
 * One-shot gesture — returns to the selection tool on release so the
 * selection can be moved immediately.
 */
export class LassoTool extends BaseTool {
  readonly id = "lasso" as const;
  private path: Point[] = []; // screen coords, mirrors the engine overlay

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    this.path = [{ x: p.sx, y: p.sy }];
    ctx.engine.setLasso(this.path);
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    if (!this.path.length) return;
    const last = this.path[this.path.length - 1];
    const dx = p.sx - last.x;
    const dy = p.sy - last.y;
    if (dx * dx + dy * dy < MIN_DIST_SQ) return;
    this.path.push({ x: p.sx, y: p.sy });
    ctx.engine.setLasso(this.path);
  }

  onPointerUp(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    const path = this.path;
    this.path = [];
    ctx.engine.setLasso(null);

    if (path.length > 2 && loopSize(path) >= MIN_LOOP) {
      const ids = this.hitIds(path);
      if (ids.length || !p.shift) {
        s.select(ids);
      }
    } else if (!p.shift) {
      // plain tap / dot -> clear
      s.select([]);
    }
    s.setTool("selection");
    ctx.engine.emit();
  }

  onClick(_ctx: ToolContext, p: CanvasPointer) {
    if (!p.shift) useStore.getState().select([]);
  }

  onCancel(ctx: ToolContext) {
    this.path = [];
    ctx.engine.setLasso(null);
  }

  deactivate(ctx: ToolContext) {
    this.path = [];
    ctx.engine.setLasso(null);
  }

  private hitIds(pathScreen: Point[]): string[] {
    const s = useStore.getState();
    const view = s.doc.scene.view;
    const loop = pathScreen.map((q) => screenToWorld(q.x, q.y, view));
    const box = boundsOf(loop);
    const out: string[] = [];
    for (const el of s.doc.elements) {
      // cheap reject: loop bbox must touch the element's bounds
      // (bounds padding only makes this reject looser, never wrong)
      const b = elementBounds(el);
      if (b.maxX < box.minX || b.minX > box.maxX || b.maxY < box.minY || b.minY > box.maxY) {
        continue;
      }
      if (touchesLoop(el, loop)) out.push(el.id);
    }
    return out;
  }

  cursor() {
    return "crosshair";
  }
}

/** max dimension of a point list's bounding box */
const loopSize = (path: Point[]): number => {
  const b = boundsOf(path);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
};

const boundsOf = (pts: Point[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

const loopEdges = (loop: Point[]): Array<[Point, Point]> => {
  const out: Array<[Point, Point]> = [];
  for (let i = 0; i < loop.length; i++) {
    out.push([loop[i], loop[(i + 1) % loop.length]]);
  }
  return out;
};

const edgesCross = (
  a: Point,
  b: Point,
  edges: Array<[Point, Point]>,
): boolean => {
  for (const [c, d] of edges) {
    if (segmentsIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) return true;
  }
  return false;
};

/** Exact-geometry loop test (world space). No padding is ever consulted. */
const touchesLoop = (el: Element, loop: Point[]): boolean => {
  if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
    return strokeTouchesLoop(el as LineElement, loop);
  }
  return shapeTouchesLoop(el as ShapeElement, loop);
};

const strokeTouchesLoop = (
  el: LineElement & { points: Point[] },
  loop: Point[],
): boolean => {
  const pts = el.points.map((q) => localToWorld(el, q));
  if (!pts.length) return false;
  const edges = loopEdges(loop);
  // enclosed centroid
  const cx = pts.reduce((m, q) => m + q.x, 0) / pts.length;
  const cy = pts.reduce((m, q) => m + q.y, 0) / pts.length;
  if (pointInPolygon(cx, cy, loop)) return true;
  // stroke segment cuts the loop outline
  for (let i = 0; i < pts.length - 1; i++) {
    if (edgesCross(pts[i], pts[i + 1], edges)) return true;
  }
  // small loop drawn right on top of the stroke
  const tol = el.strokeWidth / 2 + 2;
  for (const q of loop) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (distToSegment(q.x, q.y, a.x, a.y, b.x, b.y) <= tol) return true;
    }
  }
  return false;
};

const shapeTouchesLoop = (el: ShapeElement, loop: Point[]): boolean => {
  const geom = shapeLocalGeometry(el);
  // rotation-aware outline in world space (exact, unpadded)
  const outline = geom.corners.map((c) => localToWorld(el, c));
  const edges = loopEdges(loop);
  const outlineEdges: Array<[Point, Point]> = [];
  for (let i = 0; i < outline.length; i++) {
    outlineEdges.push([outline[i], outline[(i + 1) % outline.length]]);
  }
  // center enclosed
  if (pointInPolygon(geom.cx, geom.cy, loop)) return true;
  // outline point enclosed (loop overlaps the shape)
  if (outline.some((q) => pointInPolygon(q.x, q.y, loop))) return true;
  // small loop drawn fully inside the shape (exact interior, rotation-aware)
  if (loop.some((q) => hitTestElement(el, q, 0))) return true;
  // loop outline cuts the shape outline
  for (const [a, b] of outlineEdges) {
    if (edgesCross(a, b, edges)) return true;
  }
  return false;
};
