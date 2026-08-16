import { useStore } from "../core/store";
import { makeText } from "../core/elements";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import { resizeTextElement } from "../render/renderer";

export class TextTool extends BaseTool {
  readonly id = "text" as const;

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    const el = makeText(p.wx, p.wy, "", { ...s.activeStyle, fillStyle: "solid" }, 20);
    const fitted = resizeTextElement(el);
    s.beginGesture();
    s.setElementsLive([...s.doc.elements, fitted]);
    s.setEditingText(fitted.id);
    s.setPreviewing(false);
    s.commit();
    s.select([fitted.id]);
    ctx.engine.emit();
  }

  cursor() {
    return "text";
  }
}