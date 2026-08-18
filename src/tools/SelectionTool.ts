import type { Element, LineElement, Point, TextElement } from "../types";
import { useStore } from "../core/store";
import { BaseTool, type ToolContext } from "./Tool";
import type { CanvasPointer } from "../render/engine";
import { hitTestElements, elementsInRect, worldToLocal } from "../render/geometry";
import {
  resizeElement,
  resizeGroup,
  rotateElements,
  clampAngle,
  type ResizeHandle,
} from "../render/resize";
import {
  computeSelectionVisual,
  hitTestHandle,
  hitTestLinePoint,
  hitTestLineMidpoint,
  insertLinePoint,
} from "../render/selectionOverlay";
import { degreesToRadians } from "../util/math";
import { measureTextWidth, textHeight } from "../render/renderer";

type Mode =
  | { kind: "idle" }
  | { kind: "move"; startElements: Element[]; startP: Point }
  | { kind: "resize"; handle: Exclude<ResizeHandle, "rotate">; startElements: Element[]; box: ReturnType<typeof computeSelectionVisual> }
  | { kind: "rotate"; startElements: Element[]; box: ReturnType<typeof computeSelectionVisual> }
  | { kind: "linepoint"; line: LineElement; index: number }
  | { kind: "marquee"; startP: Point; startScreen: Point };

export class SelectionTool extends BaseTool {
  readonly id = "selection" as const;
  private mode: Mode = { kind: "idle" };
  private lastClick: { id: string; time: number } | null = null;

  private getSelected(ctx: ToolContext): Element[] {
    void ctx;
    const s = useStore.getState();
    const ids = new Set(s.selectedIds);
    return s.doc.elements.filter((e) => ids.has(e.id));
  }

  onPointerDown(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    if (s.editingTextId) {
      s.setEditingText(null);
      return;
    }
    const selected = this.getSelected(ctx);

    // 0. line / arrow curve-point editing (single selection)
    if (selected.length === 1) {
      const sel = selected[0];
      if (sel.type === "line" || sel.type === "arrow") {
        const line = sel as LineElement;
        const idx = hitTestLinePoint(line, { x: p.sx, y: p.sy }, ctx.getView());
        if (idx !== null) {
          s.beginGesture();
          this.mode = { kind: "linepoint", line, index: idx };
          return;
        }
        const seg = hitTestLineMidpoint(line, { x: p.sx, y: p.sy }, ctx.getView());
        if (seg !== null) {
          s.beginGesture();
          const withPoint = insertLinePoint(line, seg);
          s.setElementsLive(replaceByIds(s.doc.elements, [withPoint]));
          this.mode = { kind: "linepoint", line: withPoint, index: seg + 1 };
          return;
        }
      }
    }

    // 1. try handles
    if (selected.length) {
      const visual = computeSelectionVisual(selected);
      const handle = hitTestHandle(visual, { x: p.sx, y: p.sy }, ctx.getView());
      if (handle === "rotate") {
        s.beginGesture();
        this.mode = { kind: "rotate", startElements: selected, box: visual };
        return;
      }
      if (handle) {
        s.beginGesture();
        this.mode = { kind: "resize", handle, startElements: selected, box: visual };
        return;
      }
    }

    // 2. hit element
    const hit = hitTestElements(s.doc.elements, { x: p.wx, y: p.wy });
    if (hit) {
      const inSelection = s.selectedIds.includes(hit.id);
      if (p.shift) {
        s.select([hit.id], true);
        const after = this.getSelected(ctx);
        if (after.some((e) => e.id === hit.id)) {
          this.mode = { kind: "move", startElements: after, startP: { x: p.wx, y: p.wy } };
          s.beginGesture();
        }
        return;
      }
      if (!inSelection) {
        s.select([hit.id]);
      }
      const after = this.getSelected(ctx);
      this.mode = { kind: "move", startElements: after, startP: { x: p.wx, y: p.wy } };
      s.beginGesture();
      return;
    }

    // 3. marquee / clear
    if (!p.shift) {
      s.select([]);
    }
    this.mode = { kind: "marquee", startP: { x: p.wx, y: p.wy }, startScreen: { x: p.sx, y: p.sy } };
  }

  onPointerMove(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    const m = this.mode;

    if (m.kind === "linepoint") {
      const line = m.line;
      const local = worldToLocal(line, { x: p.wx, y: p.wy });
      const pts = line.points.map((pt, i) => (i === m.index ? local : pt));
      const next = { ...line, points: pts };
      s.setElementsLive(replaceByIds(s.doc.elements, [next]));
      this.mode = { ...m, line: next };
      return;
    }

    if (m.kind === "move") {
      let dx = p.wx - m.startP.x;
      let dy = p.wy - m.startP.y;
      if (p.shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
        // snap to grid
        dx = Math.round(dx / 8) * 8;
        dy = Math.round(dy / 8) * 8;
      }
      if (dx === 0 && dy === 0) return;
      const next = m.startElements.map((el) => {
        if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      });
      s.setElementsLive(replaceByIds(s.doc.elements, next));
    } else if (m.kind === "resize") {
      if (m.startElements.length === 1) {
        const el = m.startElements[0];
        const next = resizeElement(el, m.handle, { x: p.wx, y: p.wy }, p.shift);
        if (next.type === "text") {
          s.setElementsLive(replaceByIds(s.doc.elements, [next]));
        } else {
          s.setElementsLive(replaceByIds(s.doc.elements, [next]));
        }
      } else {
        const origin = oppositeWorld(m.box, m.handle);
        const next = resizeGroup(m.startElements, m.handle, { x: p.wx, y: p.wy }, p.shift, origin);
        s.setElementsLive(replaceByIds(s.doc.elements, next));
      }
    } else if (m.kind === "rotate") {
      const center = m.box.center;
      let angle = Math.atan2(p.wy - center.y, p.wx - center.x);
      if (p.shift) angle = clampAngle(angle, degreesToRadians(15));
      const startAngle = m.startElements.length === 1 ? m.startElements[0].angle : 0;
      const delta = angle - startAngle;
      const next = rotateElements(m.startElements, delta, center);
      s.setElementsLive(replaceByIds(s.doc.elements, next));
    } else if (m.kind === "marquee") {
      const x = Math.min(p.wx, m.startP.x);
      const y = Math.min(p.wy, m.startP.y);
      const w = Math.abs(p.wx - m.startP.x);
      const h = Math.abs(p.wy - m.startP.y);
      const sx = Math.min(p.sx, m.startScreen.x);
      const sy = Math.min(p.sy, m.startScreen.y);
      const sw = Math.abs(p.sx - m.startScreen.x);
      const sh = Math.abs(p.sy - m.startScreen.y);
      ctx.engine.setMarquee({ x: sx, y: sy, w: sw, h: sh });
      if (!p.shift) {
        const hits = elementsInRect(s.doc.elements, { x, y, w, h });
        s.select(hits.map((e) => e.id));
      }
    }
  }

  onPointerUp(ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    const m = this.mode;
    if (m.kind === "move") {
      const moved = this.getSelected(ctx);
      if (moved.length) {
        s.commit();
      }
    } else if (m.kind === "linepoint") {
      s.commit();
    } else if (m.kind === "resize" || m.kind === "rotate") {
      s.commit();
      // re-measure text after resize
      const sel = this.getSelected(ctx);
      const fixed = sel.map((el) =>
        el.type === "text" ? fitTextElement(el as TextElement) : el,
      );
      s.setElementsLive(replaceByIds(s.doc.elements, fixed));
      s.commit();
    } else if (m.kind === "marquee") {
      ctx.engine.setMarquee(null);
      const x = Math.min(p.wx, m.startP.x);
      const y = Math.min(p.wy, m.startP.y);
      const w = Math.abs(p.wx - m.startP.x);
      const h = Math.abs(p.wy - m.startP.y);
      const hits = elementsInRect(s.doc.elements, { x, y, w, h });
      if (hits.length || !p.shift) {
        s.select(hits.map((e) => e.id));
      }
    }
    this.mode = { kind: "idle" };
    ctx.engine.emit();
  }

  onClick(_ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    const hit = hitTestElements(s.doc.elements, { x: p.wx, y: p.wy });
    if (hit && (hit.type === "text" || hit.type === "sticky")) {
      const now = Date.now();
      if (this.lastClick && this.lastClick.id === hit.id && now - this.lastClick.time < 500) {
        s.setEditingText(hit.id);
        this.lastClick = null;
        return;
      }
      this.lastClick = { id: hit.id, time: now };
    } else {
      this.lastClick = null;
    }
  }

  onDoubleClick(_ctx: ToolContext, p: CanvasPointer) {
    const s = useStore.getState();
    const hit = hitTestElements(s.doc.elements, { x: p.wx, y: p.wy });
    if (hit) {
      s.select([hit.id]);
      if (hit.type === "text" || hit.type === "sticky") {
        s.setEditingText(hit.id);
        return;
      }
    }
  }

  onKeyDown(_ctx: ToolContext, e: KeyboardEvent): boolean {
    const s = useStore.getState();
    if (!s.selectedIds.length) return false;
    const dir =
      e.key === "ArrowLeft"
        ? { dx: -1, dy: 0 }
        : e.key === "ArrowRight"
          ? { dx: 1, dy: 0 }
          : e.key === "ArrowUp"
            ? { dx: 0, dy: -1 }
            : e.key === "ArrowDown"
              ? { dx: 0, dy: 1 }
              : null;
    if (!dir) return false;
    const mul = e.shiftKey ? 8 : 1;
    const ids = new Set(s.selectedIds);
    const next = s.doc.elements.map((el) =>
      ids.has(el.id) ? { ...el, x: el.x + dir.dx * mul, y: el.y + dir.dy * mul } : el,
    );
    s.beginGesture();
    s.setElementsLive(next);
    s.commit();
    return true;
  }

  onCancel() {
    const s = useStore.getState();
    this.mode = { kind: "idle" };
    s.setPreviewing(false);
    const engine = marqueeCleanup?.engine;
    if (engine) engine.clearMarquee();
  }

  cursor(ctx: ToolContext, p?: CanvasPointer): string {
    const s = useStore.getState();
    if (!p) return "default";
    if (this.mode.kind === "linepoint") return "move";
    if (this.mode.kind === "move") return "move";
    if (this.mode.kind === "resize") {
      return cursorForHandle(this.mode.handle);
    }
    if (this.mode.kind === "rotate") return "grab";
    const selected = this.getSelected(ctx);
    if (selected.length) {
      const visual = computeSelectionVisual(selected);
      const h = hitTestHandle(visual, { x: p.sx, y: p.sy }, ctx.getView());
      if (h === "rotate") return "grab";
      if (h) return cursorForHandle(h);
    }
    const hit = hitTestElements(s.doc.elements, { x: p.wx, y: p.wy });
    if (hit) return "move";
    return "default";
  }
}

let marqueeCleanup: { engine: { clearMarquee(): void } } | null = null;

export const setMarqueeCleanup = (engine: { clearMarquee(): void }) => {
  marqueeCleanup = { engine };
};

const cursorForHandle = (h: ResizeHandle) => {
  switch (h) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    default:
      return "default";
  }
};

const replaceByIds = (elements: Element[], updated: Element[]) => {
  const map = new Map(updated.map((e) => [e.id, e]));
  return elements.map((e) => map.get(e.id) ?? e);
};

const oppositeWorld = (
  box: ReturnType<typeof computeSelectionVisual>,
  handle: Exclude<ResizeHandle, "rotate">,
): Point => {
  const opp: Record<Exclude<ResizeHandle, "rotate">, keyof typeof box.handles> = {
    nw: "se",
    n: "s",
    ne: "sw",
    e: "w",
    se: "nw",
    s: "n",
    sw: "ne",
    w: "e",
  };
  return box.handles[opp[handle]];
};

const fitTextElement = (el: TextElement): TextElement => {
  if (!el.text) return el;
  const w = measureTextWidth(el);
  const h = textHeight(el);
  return { ...el, width: w, height: h };
};