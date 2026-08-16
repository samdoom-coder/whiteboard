import type { LineElement } from "../types";
import { useStore } from "../core/store";
import { makeArrow, makeLine } from "../core/elements";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import { nearestShape } from "../render/geometry";
import { degreesToRadians } from "../util/math";

const BIND_DIST = 16;

export class LineArrowTool extends BaseTool {
  readonly id: "line" | "arrow";
  private temp: LineElement | null = null;
  private mode: "drawing" | null = null;

  constructor(id: "line" | "arrow") {
    super();
    this.id = id;
  }

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    s.beginGesture();
    s.setPreviewing(true);
    this.mode = "drawing";
    const el =
      this.id === "arrow"
        ? makeArrow(p.wx, p.wy, { x: 0, y: 0 }, { x: 0, y: 0 }, { ...s.activeStyle })
        : makeLine(p.wx, p.wy, { x: 0, y: 0 }, { x: 0, y: 0 }, { ...s.activeStyle });
    this.temp = el;
    s.setElementsLive([...s.doc.elements, el]);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    if (!this.mode || !this.temp) return;
    const s = useStore.getState();
    let dx = p.wx - this.temp.x;
    let dy = p.wy - this.temp.y;
    if (p.shift) {
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / degreesToRadians(15)) * degreesToRadians(15);
      const len = Math.hypot(dx, dy);
      dx = Math.cos(snapped) * len;
      dy = Math.sin(snapped) * len;
    }
    const el: LineElement = { ...this.temp, points: [{ x: 0, y: 0 }, { x: dx, y: dy }] };
    this.temp = el;
    s.setElementsLive([...s.doc.elements.filter((e) => e.id !== el.id), el]);
    ctx.engine.emit();
  }

  onPointerUp(ctx: ToolContext, p: CanvasPointer) {
    if (!this.mode || !this.temp) {
      this.mode = null;
      return;
    }
    const s = useStore.getState();
    const el = this.temp;
    this.temp = null;
    this.mode = null;
    void p;
    s.setPreviewing(false);
    const len = Math.hypot(el.points[1].x, el.points[1].y);
    if (len < 2) {
      s.setElementsLive(s.doc.elements.filter((e) => e.id !== el.id));
      s.commit();
      return;
    }

    // binding
    const others = s.doc.elements.filter((e) => e.id !== el.id);
    const startWorld = { x: el.x, y: el.y };
    const endWorld = { x: el.x + el.points[1].x, y: el.y + el.points[1].y };

    let el2 = el;
    // start binding: find shape near start, but only if pointer ended away from it
    const startShape = nearestShape(others, startWorld, BIND_DIST);
    const endShape = nearestShape(others, endWorld, BIND_DIST);
    if (startShape && startShape.id !== endShape?.id) {
      el2 = { ...el2, startBinding: { elementId: startShape.id, end: 0 } };
    }
    if (endShape) {
      el2 = { ...el2, endBinding: { elementId: endShape.id, end: 1 } };
    }

    const next = [...others, el2];
    s.setElementsLive(next);
    s.commit();
    s.select([el2.id]);
    s.setTool("selection");
    ctx.engine.emit();
  }

  onCancel() {
    const s = useStore.getState();
    if (this.temp) {
      s.setElementsLive(s.doc.elements.filter((e) => e.id !== this.temp!.id));
      s.commit();
    }
    this.temp = null;
    this.mode = null;
    s.setPreviewing(false);
  }

  cursor() {
    return "crosshair";
  }
}