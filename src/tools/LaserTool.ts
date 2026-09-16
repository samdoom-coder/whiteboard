import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import {
  laserCancel,
  laserEnd,
  laserHideCursor,
  laserMove,
  laserSetCursor,
  laserStart,
} from "../core/laser";

/**
 * Laser pointer: draws glowing trails that fade away after ~1s.
 * Nothing is written to the document, so it never pollutes undo history,
 * persistence, or collaboration. The tool stays active until the user
 * picks another tool (unlike pencil/shapes which return to selection).
 */
export class LaserTool extends BaseTool {
  readonly id = "laser" as const;
  private drawing = false;

  activate() {
    this.drawing = false;
  }

  deactivate() {
    this.drawing = false;
    laserEnd();
    laserHideCursor();
  }

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    void ctx;
    this.drawing = true;
    laserStart(p.wx, p.wy);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    laserSetCursor(p.wx, p.wy);
    if (!this.drawing) {
      ctx.engine.emit();
      return;
    }
    laserMove(p.wx, p.wy);
    ctx.engine.emit();
  }

  onPointerUp(ctx: ToolContext) {
    void ctx;
    // keep the trail so it can fade; just stop extending it
    this.drawing = false;
    laserEnd();
    ctx.engine.emit();
  }

  onCancel() {
    this.drawing = false;
    laserCancel();
  }

  cursor() {
    // hidden — the engine draws a glowing laser dot instead
    return "none";
  }
}
