import { useStore } from "../core/store";
import { makeImage } from "../core/elements";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import { clearImageCache } from "../render/renderer";

export interface PendingImage {
  dataURL: string;
  width: number;
  height: number;
}

let pending: PendingImage | null = null;
let pickerHandler: (() => void) | null = null;

export const setImagePickerHandler = (fn: () => void) => {
  pickerHandler = fn;
};

export const setPendingImage = (img: PendingImage | null) => {
  pending = img;
  if (img) clearImageCache();
};

export const getPendingImage = () => pending;

export class ImageTool extends BaseTool {
  readonly id = "image" as const;

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    if (pending) {
      const el = makeImage(p.wx, p.wy, pending.dataURL, pending.width, pending.height, {
        ...s.activeStyle,
      });
      setPendingImage(null);
      s.addElements([el]);
      s.select([el.id]);
      ctx.engine.emit();
    } else {
      pickerHandler?.();
    }
  }

  cursor() {
    return "copy";
  }
}