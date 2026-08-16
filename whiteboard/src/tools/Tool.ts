import type { ViewState, ToolType } from "../types";
import type { CanvasEngine, CanvasPointer } from "../render/engine";

export interface ToolContext {
  engine: CanvasEngine;
  getView(): ViewState;
}

export interface Tool {
  readonly id: ToolType;
  onPointerDown(ctx: ToolContext, p: CanvasPointer): void;
  onPointerMove(ctx: ToolContext, p: CanvasPointer): void;
  onPointerUp(ctx: ToolContext, p: CanvasPointer): void;
  onClick?(ctx: ToolContext, p: CanvasPointer): void;
  onDoubleClick?(ctx: ToolContext, p: CanvasPointer): void;
  onKeyDown?(ctx: ToolContext, e: KeyboardEvent): boolean;
  onCancel?(ctx: ToolContext): void;
  activate?(ctx: ToolContext): void;
  deactivate?(ctx: ToolContext): void;
  cursor(ctx: ToolContext, p?: CanvasPointer): string;
}

export abstract class BaseTool implements Tool {
  abstract readonly id: ToolType;
  onPointerDown(_ctx: ToolContext, _p: CanvasPointer): void {}
  onPointerMove(_ctx: ToolContext, _p: CanvasPointer): void {}
  onPointerUp(_ctx: ToolContext, _p: CanvasPointer): void {}
  onDoubleClick(_ctx: ToolContext, _p: CanvasPointer): void {}
  onKeyDown(_ctx: ToolContext, _e: KeyboardEvent): boolean {
    return false;
  }
  onCancel(_ctx: ToolContext): void {}
  activate(_ctx: ToolContext): void {}
  deactivate(_ctx: ToolContext): void {}
  cursor(_ctx: ToolContext, _p?: CanvasPointer): string {
    return "default";
  }
}