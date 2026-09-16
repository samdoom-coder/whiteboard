import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import { useCollab } from "../core/collaboration";
import {
  laserCancel,
  laserEnd,
  laserHideCursor,
  laserMove,
  laserSetCursor,
  laserStart,
} from "../core/laser";

/**
 * Laser pointer: draws glowing trails that fade away after ~2s.
 * Nothing is written to the document, so it never pollutes undo history
 * or persistence. Strokes are broadcast to collaborators (in your color)
 * while you draw. The tool stays active until the user picks another
 * tool (unlike pencil/shapes which return to selection).
 */
export class LaserTool extends BaseTool {
  readonly id = "laser" as const;
  private drawing = false;

  activate() {
    this.drawing = false;
  }

  deactivate() {
    if (this.drawing) {
      this.drawing = false;
      useCollab.getState().publishLaserNow(0, 0, false);
    }
    laserEnd();
    laserHideCursor();
  }

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    void ctx;
    this.drawing = true;
    laserStart(p.wx, p.wy);
    // stroke start goes out immediately so short taps are never lost
    useCollab.getState().publishLaserNow(p.wx, p.wy, true);
    ctx.engine.emit();
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    laserSetCursor(p.wx, p.wy);
    if (!this.drawing) {
      ctx.engine.emit();
      return;
    }
    laserMove(p.wx, p.wy);
    useCollab.getState().publishLaser(p.wx, p.wy, true);
    ctx.engine.emit();
  }

  onPointerUp(ctx: ToolContext, p: CanvasPointer) {
    // keep the trail so it can fade; just stop extending it
    this.drawing = false;
    laserEnd();
    useCollab.getState().publishLaserNow(p.wx, p.wy, false);
    ctx.engine.emit();
  }

  onClick(ctx: ToolContext, p: CanvasPointer) {
    // press + release without dragging: leave a fading dot behind
    void ctx;
    this.drawing = false;
    laserEnd();
    useCollab.getState().publishLaserNow(p.wx, p.wy, false);
    ctx.engine.emit();
  }

  onCancel() {
    if (this.drawing) {
      this.drawing = false;
      useCollab.getState().publishLaserNow(0, 0, false);
    }
    laserCancel();
  }

  cursor() {
    // hidden — the engine draws a glowing laser dot instead
    return "none";
  }
}
