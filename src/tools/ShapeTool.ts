import type { Element, Point, ToolType } from "../types";
import { useStore } from "../core/store";
import {
  makeDiamond,
  makeEllipse,
  makeRectangle,
  makeRoundedRectangle,
} from "../core/elements";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";

export class ShapeTool extends BaseTool {
  readonly id: ToolType;
  private temp: Element | null = null;
  private start: Point = { x: 0, y: 0 };
  private mode: "drawing" | null = null;

  constructor(id: ToolType) {
    super();
    this.id = id;
  }

  private create(x: number, y: number, w: number, h: number): Element {
    const s = useStore.getState();
    const base = { ...s.activeStyle };
    switch (this.id) {
      case "rectangle":
        return makeRectangle(x, y, w, h, base);
      case "roundedRectangle":
        return makeRoundedRectangle(x, y, w, h, base);
      case "ellipse":
        return makeEllipse(x, y, w, h, base);
      case "diamond":
        return makeDiamond(x, y, w, h, base);
    }
    return makeRectangle(x, y, w, h, base);
  }

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    s.beginGesture();
    s.setPreviewing(true);
    this.mode = "drawing";
    this.start = { x: p.wx, y: p.wy };
    const el = this.create(p.wx, p.wy, 0, 0);
    this.temp = el;
    s.setElementsLive([...s.doc.elements, el]);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    if (!this.mode || !this.temp) return;
    const s = useStore.getState();
    let { wx, wy } = p;
    // shift -> square
    const dx0 = wx - this.start.x;
    const dy0 = wy - this.start.y;
    if (p.shift) {
      const m = Math.max(Math.abs(dx0), Math.abs(dy0));
      wx = this.start.x + (dx0 < 0 ? -m : m);
      wy = this.start.y + (dy0 < 0 ? -m : m);
    }
    let x = Math.min(this.start.x, wx);
    let y = Math.min(this.start.y, wy);
    let w = Math.abs(wx - this.start.x);
    let h = Math.abs(wy - this.start.y);

    const el = {
      ...this.temp!,
      x,
      y,
      width: w,
      height: h,
    };
    this.temp = el;
    s.setElementsLive([...s.doc.elements.filter((e) => e.id !== el.id), el]);
    ctx.engine.emit();
  }

  onPointerUp(ctx: ToolContext, _p: CanvasPointer) {
    if (!this.mode || !this.temp) {
      this.mode = null;
      return;
    }
    const s = useStore.getState();
    const el = this.temp;
    this.temp = null;
    this.mode = null;
    s.setPreviewing(false);
    if (el.width < 2 && el.height < 2) {
      // tiny click -> remove temp
      s.setElementsLive(s.doc.elements.filter((e) => e.id !== el.id));
      s.commit();
      return;
    }
    // ensure final shape uses current style (in case user changed mid-draw)
    s.setElementsLive([...s.doc.elements.filter((e) => e.id !== el.id), el]);
    s.commit();
    s.select([el.id]);
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