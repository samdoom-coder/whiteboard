import type { Element, Point } from "../types";
import { useStore } from "../core/store";
import { makeSticky } from "../core/elements";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";

const DEFAULT_W = 190;
const DEFAULT_H = 160;
const MIN_W = 60;
const MIN_H = 50;

export class StickyTool extends BaseTool {
  readonly id = "sticky" as const;
  private temp: Element | null = null;
  private start: Point = { x: 0, y: 0 };
  private mode: "drawing" | null = null;

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    s.beginGesture();
    s.setPreviewing(true);
    this.mode = "drawing";
    this.start = { x: p.wx, y: p.wy };
    const el = makeSticky(p.wx, p.wy, "", { ...s.activeStyle });
    this.temp = el;
    s.setElementsLive([...s.doc.elements, el]);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    if (!this.mode || !this.temp) return;
    const s = useStore.getState();
    const x = Math.min(this.start.x, p.wx);
    const y = Math.min(this.start.y, p.wy);
    const w = Math.max(MIN_W, Math.abs(p.wx - this.start.x));
    const h = Math.max(MIN_H, Math.abs(p.wy - this.start.y));
    const el = { ...this.temp!, x, y, width: w, height: h };
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
    let el = this.temp;
    this.temp = null;
    this.mode = null;
    s.setPreviewing(false);

    // plain click -> keep the default size
    if (el.width <= MIN_W && el.height <= MIN_H) {
      el = { ...el, x: this.start.x, y: this.start.y, width: DEFAULT_W, height: DEFAULT_H };
    }

    s.setElementsLive([...s.doc.elements.filter((e) => e.id !== el.id), el]);
    s.commit();
    s.select([el.id]);
    s.setEditingText(el.id);
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