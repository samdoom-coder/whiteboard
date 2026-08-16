import { useStore } from "../core/store";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import { hitTestElements } from "../render/geometry";

export class EraserTool extends BaseTool {
  readonly id = "eraser" as const;
  private erased = new Set<string>();
  private active = false;

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    s.beginGesture();
    this.active = true;
    this.erased = new Set();
    this.eraseAt(p);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    if (!this.active) return;
    this.eraseAt(p);
    ctx.engine.emit();
  }

  onPointerUp(_ctx: ToolContext) {
    if (!this.active) return;
    this.active = false;
    useStore.getState().commit();
  }

  onCancel() {
    this.active = false;
    this.erased.clear();
  }

  private eraseAt(p: CanvasPointer) {
    const s = useStore.getState();
    const hit = hitTestElements(s.doc.elements, { x: p.wx, y: p.wy });
    if (hit && !this.erased.has(hit.id)) {
      this.erased.add(hit.id);
      const next = s.doc.elements.filter((e) => e.id !== hit.id).map((e) => {
        if (e.type === "line" || e.type === "arrow") {
          let el = e;
          if (el.startBinding?.elementId === hit.id) el = { ...el, startBinding: null };
          if (el.endBinding?.elementId === hit.id) el = { ...el, endBinding: null };
          return el;
        }
        return e;
      });
      s.setElementsLive(next);
    }
  }

  cursor() {
    return "not-allowed";
  }
}