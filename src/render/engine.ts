import type { Element, ViewState } from "../types";
import { useStore } from "../core/store";
import { contrastingColor, palettes } from "../util/color";
import { screenToWorld, zoomAtScreen } from "./camera";
import { drawElement } from "./renderer";
import { drawSelectionOverlay } from "./selectionOverlay";
import { elementBounds, boundsFromElements } from "./geometry";
import type { Tool } from "../tools/Tool";
import { tools } from "../tools";
import { LASER_FADE_MS, getLaserCursor, getLaserTrails, laserSetCursor } from "../core/laser";

export interface CanvasPointer {
  sx: number;
  sy: number;
  wx: number;
  wy: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  button: number;
  pointerType: string;
  id: number;
}

export class CanvasEngine {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private raf = 0;
  private running = false;

  private pointers = new Map<number, CanvasPointer>();
  private pointerState: "idle" | "down" | "dragging" = "idle";
  private downPointer: CanvasPointer | null = null;
  private spaceHeld = false;
  private panningViaSpace = false;
  private panningViaMiddle = false;
  private lastPan: { x: number; y: number } | null = null;

  // pinch
  private pinchDistance = 0;
  private pinchStartZoom = 1;

  private listeners = new Set<() => void>();
  private activeTool: Tool | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.bindEvents();
    this.resize();
    this.activeTool = tools.get(useStore.getState().tool) ?? null;
    this.subscribeStore();
    this.start();
  }

  /** React components can subscribe to repaint requests / cursor changes. */
  onChange(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Notify React components (cursor changes etc). */
  emit() {
    this.listeners.forEach((cb) => cb());
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    this.listeners.clear();
  }

  // ---------- sizing ----------
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.requestRender();
  }

  get viewport() {
    return { width: this.width, height: this.height };
  }

  // ---------- store subscription ----------
  private unsubs: Array<() => void> = [];
  private subscribeStore() {
    const s = useStore.subscribe((state, prev) => {
      if (state.tool !== prev.tool) {
        this.activeTool?.deactivate?.(this.toolCtx());
        this.activeTool = tools.get(state.tool) ?? null;
        this.activeTool?.activate?.(this.toolCtx());
        this.emit();
      }
      if (
        state.doc.elements !== prev.doc.elements ||
        state.doc.scene.view !== prev.doc.scene.view ||
        state.theme !== prev.theme ||
        state.selectedIds !== prev.selectedIds ||
        state.editingTextId !== prev.editingTextId ||
        state.previewing !== prev.previewing
      ) {
        this.requestRender();
      }
    });
    this.unsubs.push(s);
  }

  // ---------- render loop ----------
  start() {
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      void t;
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  requestRender() {
    if (!this.running) return;
  }

  private render() {
    const ctx = this.ctx;
    const state = useStore.getState();
    const view = state.doc.scene.view;

    // background
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = state.doc.scene.backgroundColor;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawBackground(ctx, view);

    // elements
    const worldVisible = this.visibleWorldRect(view);
    const els = state.doc.elements;
    ctx.setTransform(
      this.dpr * view.zoom,
      0,
      0,
      this.dpr * view.zoom,
      this.dpr * view.scrollX,
      this.dpr * view.scrollY,
    );

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.isDeleted) continue;
      if (!this.isVisible(el, worldVisible)) continue;
      drawElement(ctx, el, { editingTextId: state.editingTextId });
    }

    // selection overlay
    if (state.selectedIds.length) {
      const selEls = state.selectedIds
        .map((id) => state.doc.elements.find((e) => e.id === id))
        .filter(Boolean) as Element[];
      if (selEls.length) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        drawSelectionOverlay(ctx, selEls, view, state.theme);
      }
    }

    // marquee
    if (this.marquee) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawMarquee(ctx, this.marquee, state.theme);
    }

    this.drawLaser(ctx, view);
  }

  private marquee: { x: number; y: number; w: number; h: number } | null = null;
  setMarquee(r: { x: number; y: number; w: number; h: number } | null) {
    this.marquee = r;
    this.emit();
  }

  clearMarquee() {
    this.marquee = null;
  }

  private drawMarquee(
    ctx: CanvasRenderingContext2D,
    r: { x: number; y: number; w: number; h: number },
    theme: keyof typeof palettes,
  ) {
    const p = palettes[theme];
    ctx.save();
    ctx.strokeStyle = p.selectionBorder;
    ctx.fillStyle = p.selectionFill;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Glowing ephemeral laser trails + cursor dot (never persisted). */
  private drawLaser(ctx: CanvasRenderingContext2D, view: ViewState) {
    const trails = getLaserTrails();
    const cursor = getLaserCursor();
    const isLaserTool = useStore.getState().tool === "laser";
    if (!trails.length && !(isLaserTool && cursor.visible)) return;

    const now = Date.now();
    ctx.save();
    ctx.setTransform(
      this.dpr * view.zoom,
      0,
      0,
      this.dpr * view.zoom,
      this.dpr * view.scrollX,
      this.dpr * view.scrollY,
    );
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const trail of trails) {
      if (!trail.points.length) continue;
      ctx.save();
      // Stamp filled circles (no shadowBlur, no per-segment strokes) so the
      // trail is one smooth glowing line with no dots/gaps at joints.
      // Points are interpolated to keep stamps densely overlapping even on
      // fast strokes. Remote peers' trails use their cursor color.
      const color = trail.color ?? "#ff2e2e";
      ctx.fillStyle = color;
      const step = 1.6 / view.zoom;
      const stamp = (x: number, y: number, alpha: number) => {
        const a = Math.max(0, Math.min(1, alpha));
        if (a <= 0) return;
        const coreR = (0.9 + 1.0 * a) / view.zoom;
        // tight, subtle halo only — keeps the beam crisp, not blurry
        const glowR = coreR * 1.6;
        ctx.globalAlpha = 0.1 * a;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();
      };
      if (trail.points.length === 1) {
        const pt = trail.points[0];
        stamp(pt.x, pt.y, 1 - (now - pt.t) / LASER_FADE_MS);
      } else {
        for (let i = 1; i < trail.points.length; i++) {
          const a = trail.points[i - 1];
          const b = trail.points[i];
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const steps = Math.max(1, Math.ceil(dist / step));
          for (let s = 1; s <= steps; s++) {
            const f = s / steps;
            const x = a.x + (b.x - a.x) * f;
            const y = a.y + (b.y - a.y) * f;
            const t = a.t + (b.t - a.t) * f;
            stamp(x, y, 1 - (now - t) / LASER_FADE_MS);
          }
        }
        // make sure the very first point is painted too
        const first = trail.points[0];
        stamp(first.x, first.y, 1 - (now - first.t) / LASER_FADE_MS);
      }
      ctx.restore();
    }

    // live dot follows the pointer while the laser tool is active
    if (isLaserTool && cursor.visible) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ff2e2e";
      ctx.shadowColor = "rgba(255,46,46,0.9)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 4.5 / view.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 1.5 / view.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    view: ViewState,
  ) {    const state = useStore.getState();
    const bg = state.doc.scene.background;
    const { zoom, scrollX, scrollY } = view;

    // foreground follows the canvas background brightness, not the app theme,
    // so dark canvases always get light grid/dots and vice-versa
    const bgColor = state.doc.scene.backgroundColor;
    const gridColor = contrastingColor(bgColor, "rgba(255,255,255,0.10)", "rgba(0,0,0,0.06)");
    const dotColor = contrastingColor(bgColor, "rgba(255,255,255,0.16)", "rgba(0,0,0,0.12)");

    if (bg === "grid") {
      let step = 20;
      while (step * zoom < 18) step *= 5;
      const startWorld = screenToWorld(0, 0, view);
      const endWorld = screenToWorld(this.width, this.height, view);
      const x0 = Math.floor(startWorld.x / step) * step;
      const y0 = Math.floor(startWorld.y / step) * step;
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= endWorld.x; x += step) {
        const sx = x * zoom + scrollX;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, this.height);
      }
      for (let y = y0; y <= endWorld.y; y += step) {
        const sy = y * zoom + scrollY;
        ctx.moveTo(0, sy);
        ctx.lineTo(this.width, sy);
      }
      ctx.stroke();
      ctx.restore();
    } else if (bg === "dots") {
      let step = 25;
      while (step * zoom < 22) step *= 4;
      const startWorld = screenToWorld(0, 0, view);
      const endWorld = screenToWorld(this.width, this.height, view);
      const x0 = Math.floor(startWorld.x / step) * step;
      const y0 = Math.floor(startWorld.y / step) * step;
      ctx.save();
      ctx.fillStyle = dotColor;
      const r = Math.max(0.6, 1.4 / Math.min(1, zoom) * 0.5);
      ctx.beginPath();
      for (let x = x0; x <= endWorld.x; x += step) {
        for (let y = y0; y <= endWorld.y; y += step) {
          const sx = x * zoom + scrollX;
          const sy = y * zoom + scrollY;
          ctx.moveTo(sx + r, sy);
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.restore();
    }
  }

  private visibleWorldRect(view: ViewState) {
    const a = screenToWorld(0, 0, view);
    const b = screenToWorld(this.width, this.height, view);
    return {
      minX: a.x - 100,
      minY: a.y - 100,
      maxX: b.x + 100,
      maxY: b.y + 100,
    };
  }

  private isVisible(el: Element, rect: { minX: number; minY: number; maxX: number; maxY: number }) {
    const b = elementBounds(el);
    return (
      b.maxX >= rect.minX &&
      b.minX <= rect.maxX &&
      b.maxY >= rect.minY &&
      b.minY <= rect.maxY
    );
  }

  // ---------- event binding ----------
  private onPointerDownB = (e: PointerEvent) => this.onPointerDown(e);
  private onPointerMoveB = (e: PointerEvent) => this.onPointerMove(e);
  private onPointerUpB = (e: PointerEvent) => this.onPointerUp(e);
  private onPointerCancelB = (e: PointerEvent) => this.onPointerUp(e);
  private onWheelB = (e: WheelEvent) => this.onWheel(e);
  private onKeyDownB = (e: KeyboardEvent) => this.onKeyDown(e);
  private onKeyUpB = (e: KeyboardEvent) => this.onKeyUp(e);
  private onContextMenuB = (e: Event) => e.preventDefault();

  private bindEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onPointerDownB);
    c.addEventListener("pointermove", this.onPointerMoveB);
    c.addEventListener("pointerup", this.onPointerUpB);
    c.addEventListener("pointercancel", this.onPointerCancelB);
    c.addEventListener("wheel", this.onWheelB, { passive: false });
    c.addEventListener("contextmenu", this.onContextMenuB);
    window.addEventListener("keydown", this.onKeyDownB);
    window.addEventListener("keyup", this.onKeyUpB);
  }

  private unbindEvents() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDownB);
    c.removeEventListener("pointermove", this.onPointerMoveB);
    c.removeEventListener("pointerup", this.onPointerUpB);
    c.removeEventListener("pointercancel", this.onPointerCancelB);
    c.removeEventListener("wheel", this.onWheelB);
    c.removeEventListener("contextmenu", this.onContextMenuB);
    window.removeEventListener("keydown", this.onKeyDownB);
    window.removeEventListener("keyup", this.onKeyUpB);
  }


  private updatePointer(e: PointerEvent): CanvasPointer | null {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy, useStore.getState().doc.scene.view);
    const p: CanvasPointer = {
      sx,
      sy,
      wx: w.x,
      wy: w.y,
      shift: e.shiftKey,
      alt: e.altKey,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      button: e.button,
      pointerType: e.pointerType,
      id: e.pointerId,
    };
    this.pointers.set(e.pointerId, p);
    return p;
  }

  private onPointerDown(e: PointerEvent) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.updatePointer(e);
    if (!p) return;

    // pinch second touch
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDistance = Math.hypot(a.sx - b.sx, a.sy - b.sy);
      this.pinchStartZoom = useStore.getState().doc.scene.view.zoom;
      return;
    }

    const state = useStore.getState();
    this.downPointer = p;
    // One-finger touch draws with drawing tools (shapes, lines, pencil,
    // text, sticky, image, eraser, laser) and pans with selection/hand —
    // same split as the desktop mouse. Two-finger pinch always pans/zooms.
    const touchDraws =
      p.pointerType === "touch" && state.tool !== "selection" && state.tool !== "hand";
    if (
      this.spaceHeld ||
      p.button === 1 ||
      state.tool === "hand" ||
      (p.pointerType === "touch" && !touchDraws)
    ) {
      if (p.pointerType === "touch" && !this.spaceHeld && state.tool !== "hand" && !touchDraws) {
        // one-finger drag pans with the selection tool
        this.panningViaSpace = true;
      }
      if (p.button === 1) this.panningViaMiddle = true;
      if (this.spaceHeld || state.tool === "hand") this.panningViaSpace = true;
      this.lastPan = { x: p.sx, y: p.sy };
      this.pointerState = "dragging";
      return;
    }

    this.pointerState = "down";
    const tool = this.activeTool;
    tool?.onPointerDown(this.toolCtx(), p);
  }

  private onPointerMove(e: PointerEvent) {
    const p = this.updatePointer(e);
    if (!p) return;

    // update cursor based on tool
    const tool = this.activeTool;
    if (tool) {
      this.canvas.style.cursor = tool.cursor(this.toolCtx(), p);
    }
    if (this.spaceHeld && !this.panningViaMiddle) {
      this.canvas.style.cursor = "grab";
    }

    // pinch
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
      if (this.pinchDistance > 0) {
        const mid = {
          x: (a.sx + b.sx) / 2,
          y: (a.sy + b.sy) / 2,
        };
        const zoom = this.pinchStartZoom * (d / this.pinchDistance);
        const view = useStore.getState().doc.scene.view;
        const nv = zoomAtScreen(view, mid.x, mid.y, zoom / view.zoom);
        useStore.getState().setView(nv);
      }
      return;
    }

    // panning
    if (this.panningViaSpace || this.panningViaMiddle) {
      if (this.lastPan) {
        const dx = p.sx - this.lastPan.x;
        const dy = p.sy - this.lastPan.y;
        const view = useStore.getState().doc.scene.view;
        useStore.getState().setView({
          scrollX: view.scrollX + dx,
          scrollY: view.scrollY + dy,
        });
        this.lastPan = { x: p.sx, y: p.sy };
      }
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (this.pointerState === "down" || this.pointerState === "dragging") {
      if (this.pointerState === "down") {
        const start = this.downPointer!;
        if (Math.hypot(p.sx - start.sx, p.sy - start.sy) > 3) {
          this.pointerState = "dragging";
        }
      }
      const tool = this.activeTool;
      tool?.onPointerMove(this.toolCtx(), p);
    } else if (useStore.getState().tool === "laser") {
      // hover dot while the laser tool is active (no button pressed)
      laserSetCursor(p.wx, p.wy);
    }
  }

  private onPointerUp(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;

    if (this.pointers.size === 2) {
      // end pinch when one finger lifts
    }

    if (this.panningViaSpace || this.panningViaMiddle) {
      if (e.button === 1) this.panningViaMiddle = false;
      if (p.pointerType !== "touch") this.panningViaSpace = this.spaceHeld;
      else this.panningViaSpace = false;
      this.lastPan = null;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.pointerState = "idle";
      return;
    }

    if (this.pointerState === "down" || this.pointerState === "dragging") {
      const tool = this.activeTool;
      if (this.pointerState === "down") {
        // click without drag
        tool?.onClick?.(this.toolCtx(), p);
      } else {
        tool?.onPointerUp(this.toolCtx(), p);
      }
    }

    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.pointerState = "idle";
      this.downPointer = null;
      this.pinchDistance = 0;
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const view = useStore.getState().doc.scene.view;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // pinch via ctrl+wheel or trackpad
      const factor = Math.exp(-e.deltaY * 0.0022);
      const nv = zoomAtScreen(view, sx, sy, factor);
      useStore.getState().setView(nv);
      return;
    }
    if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // shift wheel -> horizontal pan
      useStore.getState().setView({ scrollX: view.scrollX - e.deltaY });
      return;
    }
    // plain wheel -> pan
    useStore.getState().setView({
      scrollX: view.scrollX - e.deltaX,
      scrollY: view.scrollY - e.deltaY,
    });
  }

  private onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.code === "Space") {
      this.spaceHeld = true;
      this.emit();
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      const state = useStore.getState();
      if (state.previewing || state.editingTextId) {
        state.setEditingText(null);
        state.setPreviewing(false);
      }
      if (this.pointerState === "down" || this.pointerState === "dragging") {
        this.activeTool?.onCancel?.(this.toolCtx());
        this.pointerState = "idle";
        this.pointers.clear();
      }
      this.emit();
      return;
    }

    const tool = this.activeTool;
    if (tool?.onKeyDown?.(this.toolCtx(), e)) {
      e.preventDefault();
      return;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") {
      this.spaceHeld = false;
      if (this.panningViaSpace && this.pointerState === "idle") {
        this.panningViaSpace = false;
      }
      this.emit();
    }
  }

  private toolCtx() {
    return { engine: this, getView: () => useStore.getState().doc.scene.view };
  }

  // ---------- public helpers for tools ----------
  getPointerWorld(p: CanvasPointer) {
    return { x: p.wx, y: p.wy };
  }

  // ---------- navigation API for UI ----------
  zoomIn = () => {
    const s = useStore.getState();
    const view = s.doc.scene.view;
    const nv = zoomAtScreen(view, this.width / 2, this.height / 2, 1.2);
    s.setView(nv);
  };

  zoomOut = () => {
    const s = useStore.getState();
    const view = s.doc.scene.view;
    const nv = zoomAtScreen(view, this.width / 2, this.height / 2, 1 / 1.2);
    s.setView(nv);
  };

  zoomTo(zoom: number) {
    const s = useStore.getState();
    const view = s.doc.scene.view;
    const nv = zoomAtScreen(view, this.width / 2, this.height / 2, zoom / view.zoom);
    s.setView(nv);
  }

  fitToScreen = () => {
    const s = useStore.getState();
    const bounds = boundsFromElements(s.doc.elements);
    const view = s.doc.scene.view;
    if (!bounds) {
      s.setView({ scrollX: this.width / 2 - 200, scrollY: this.height / 2 - 100, zoom: 1 });
      return;
    }
    const nv = fitViewport2(view, bounds, this.width, this.height);
    s.setView(nv);
  };

  zoomToSelection = () => {
    const s = useStore.getState();
    const sel = s.selectedIds
      .map((id) => s.doc.elements.find((e) => e.id === id))
      .filter(Boolean) as Element[];
    if (!sel.length) return;
    const bounds = boundsFromElements(sel);
    if (!bounds) return;
    const nv = fitViewport2(s.doc.scene.view, bounds, this.width, this.height);
    s.setView(nv);
  };

  resetZoom = () => {
    const s = useStore.getState();
    const view = s.doc.scene.view;
    const nv = zoomAtScreen(view, this.width / 2, this.height / 2, 1 / view.zoom);
    s.setView(nv);
  };
}

const fitViewport2 = (
  view: ViewState,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  vw: number,
  vh: number,
) => {
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const padding = 80;
  if (!isFinite(bw) || bw <= 0 || !isFinite(bh) || bh <= 0) {
    return { ...view, zoom: 1, scrollX: 0, scrollY: 0 };
  }
  const zoom = Math.min(Math.max(0.1, (vw - padding * 2) / bw), (vh - padding * 2) / bh, 1.4);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { zoom, scrollX: vw / 2 - cx * zoom, scrollY: vh / 2 - cy * zoom };
};

export const worldPointAt = (e: CanvasPointer) => ({ x: e.wx, y: e.wy });