import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { elementBounds, boundsFromElements } from "../render/geometry";
import { screenToWorld } from "../render/camera";
import type { CanvasEngine } from "../render/engine";

export function Minimap({ engine }: { engine: CanvasEngine | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(true);
  const doc = useStore((s) => s.doc);
  const view = useStore((s) => s.doc.scene.view);
  const selectedIds = useStore((s) => s.selectedIds);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const bounds = boundsFromElements(doc.elements);
      if (!bounds) return;
      const bw = bounds.maxX - bounds.minX;
      const bh = bounds.maxY - bounds.minY;
      if (bw <= 0 || bh <= 0) return;
      const pad = 12;
      const scale = Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh);
      const ox = pad + (cw - pad * 2 - bw * scale) / 2 - bounds.minX * scale;
      const oy = pad + (ch - pad * 2 - bh * scale) / 2 - bounds.minY * scale;

      const toX = (x: number) => ox + x * scale;
      const toY = (y: number) => oy + y * scale;

      // elements
      for (const el of doc.elements) {
        const b = elementBounds(el);
        ctx.fillStyle = el.type === "text" ? "#8a8a86" : el.backgroundColor !== "transparent" ? el.backgroundColor : el.strokeColor;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(toX(b.minX), toY(b.minY), Math.max(2, (b.maxX - b.minX) * scale), Math.max(2, (b.maxY - b.minY) * scale));
      }
      ctx.globalAlpha = 1;

      // viewport
      const vp = {
        minX: screenToWorld(0, 0, view).x,
        minY: screenToWorld(0, 0, view).y,
        maxX: screenToWorld(cw, ch, view).x,
        maxY: screenToWorld(cw, ch, view).y,
      };
      ctx.strokeStyle = "#5b6ee1";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(toX(vp.minX), toY(vp.minY), Math.max(4, (vp.maxX - vp.minX) * scale), Math.max(4, (vp.maxY - vp.minY) * scale));
      ctx.setLineDash([]);
      void selectedIds;
    };

    render();
    const unsub = useStore.subscribe(() => render());
    return () => unsub();
  }, [doc, view, enabled, selectedIds]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engine) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const bounds = boundsFromElements(useStore.getState().doc.elements);
    if (!bounds) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const scale = Math.min((cw - 24) / bw, (ch - 24) / bh);
    const ox = 12 + (cw - 24 - bw * scale) / 2 - bounds.minX * scale;
    const oy = 12 + (ch - 24 - bh * scale) / 2 - bounds.minY * scale;
    const worldX = (sx - ox) / scale;
    const worldY = (sy - oy) / scale;
    const vp = engine.viewport;
    useStore.getState().setView({
      scrollX: vp.width / 2 - worldX * view.zoom,
      scrollY: vp.height / 2 - worldY * view.zoom,
    });
  };

  if (!enabled) return null;

  return (
    <div className="minimap" title="Minimap — click to navigate">
      <canvas ref={canvasRef} onClick={onClick} />
      <button
        className="btn btn-icon"
        onClick={() => setEnabled(false)}
        style={{ position: "absolute", top: 3, right: 3, padding: 3, background: "var(--surface)", border: "1px solid var(--border)" }}
        aria-label="Hide minimap"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}