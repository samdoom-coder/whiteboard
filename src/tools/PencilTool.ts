import type { Element, Point } from "../types";
import { useStore } from "../core/store";
import { makePencil } from "../core/elements";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";

const SIMPLIFY = 0.8;

const simplifyPoints = (pts: Point[], tolerance: number): Point[] => {
  if (pts.length < 3) return pts;
  const squared = tolerance * tolerance;
  const out: Point[] = [];
  const simplify = (start: number, end: number) => {
    let maxSq = 0;
    let index = -1;
    const a = pts[start];
    const b = pts[end];
    for (let i = start + 1; i < end; i++) {
      const sq = pointSegmentDistanceSq(pts[i], a, b);
      if (sq > maxSq) {
        maxSq = sq;
        index = i;
      }
    }
    if (maxSq > squared && index !== -1) {
      simplify(start, index);
      out.push(pts[index]);
      simplify(index, end);
    }
  };
  out.push(pts[0]);
  simplify(0, pts.length - 1);
  out.push(pts[pts.length - 1]);
  return out;
};

const pointSegmentDistanceSq = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return (p.x - cx) ** 2 + (p.y - cy) ** 2;
};

export class PencilTool extends BaseTool {
  readonly id = "pencil" as const;
  private points: Point[] = [];
  private mode: "drawing" | null = null;
  private minX = 0;
  private minY = 0;
  /** id of the stroke currently being drawn */
  private tempId: string | null = null;

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    s.beginGesture();
    s.setPreviewing(true);
    this.mode = "drawing";
    this.points = [{ x: 0, y: 0 }];
    this.minX = p.wx;
    this.minY = p.wy;
    const el = makePencil(p.wx, p.wy, [{ x: 0, y: 0 }], { ...s.activeStyle });
    this.tempId = el.id;
    s.setElementsLive([...s.doc.elements, el]);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    if (!this.mode || !this.tempId) return;
    const s = useStore.getState();
    const pt = { x: p.wx - this.minX, y: p.wy - this.minY };
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.2) return;
    this.points.push(pt);
    // update only the stroke being drawn
    const temp = s.doc.elements.find((e) => e.id === this.tempId);
    let el: Element;
    if (temp) {
      el = { ...temp, points: this.points.slice() } as Element;
    } else {
      el = makePencil(this.minX, this.minY, this.points.slice(), { ...s.activeStyle });
      this.tempId = el.id;
    }
    s.setElementsLive([...s.doc.elements.filter((e) => e.id !== this.tempId), el]);
    ctx.engine.emit();
  }

  onPointerUp(ctx: ToolContext, _p: CanvasPointer) {
    if (!this.mode) return;
    const s = useStore.getState();
    this.mode = null;
    s.setPreviewing(false);
    const simplified = simplifyPoints(this.points, SIMPLIFY);
    if (simplified.length < 2) {
      // remove
      if (this.tempId) s.setElementsLive(s.doc.elements.filter((e) => e.id !== this.tempId));
      this.tempId = null;
      this.points = [];
      s.commit();
      return;
    }
    // re-anchor to min x/y
    let minX = Infinity;
    let minY = Infinity;
    for (const p of simplified) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    }
    const normalized = simplified.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    const pencil = this.tempId ? s.doc.elements.find((e) => e.id === this.tempId) : null;
    const el = pencil
      ? { ...pencil, points: normalized, x: this.minX + minX, y: this.minY + minY }
      : makePencil(this.minX + minX, this.minY + minY, normalized, { ...s.activeStyle });
    s.setElementsLive([...s.doc.elements.filter((e) => e.id !== this.tempId), el]);
    s.commit();
    s.select([el.id]);
    s.setTool("selection");
    ctx.engine.emit();
    this.tempId = null;
    this.points = [];
  }

  onCancel() {
    const s = useStore.getState();
    if (this.tempId) {
      s.setElementsLive(s.doc.elements.filter((e) => e.id !== this.tempId));
      s.commit();
    }
    this.tempId = null;
    this.mode = null;
    this.points = [];
    s.setPreviewing(false);
  }

  cursor() {
    return "crosshair";
  }
}