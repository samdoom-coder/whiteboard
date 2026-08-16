import { useEffect, useRef, useState } from "react";
import { CanvasEngine } from "../render/engine";
import { setEngine, clearEngine } from "../render/engineRegistry";
import { useStore } from "../core/store";
import { setPendingImage } from "../tools/ImageTool";
import { setMarqueeCleanup } from "../tools/SelectionTool";
import { makeImage } from "../core/elements";
import { TextEditor } from "./TextEditor";
import { EmptyState } from "./EmptyState";
import { Minimap } from "./Minimap";

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function CanvasHost() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngineState] = useState<CanvasEngine | null>(null);
  const hasElements = useStore((s) => s.doc.elements.length > 0);
  const editingTextId = useStore((s) => s.editingTextId);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const eng = new CanvasEngine(canvas);
    setEngine(eng);
    setEngineState(eng);
    setMarqueeCleanup(eng);

    const ro = new ResizeObserver(() => eng.resize());
    ro.observe(host);

    requestAnimationFrame(() => {
      eng.resize();
      const els = useStore.getState().doc.elements;
      if (els.length) eng.fitToScreen();
    });

    return () => {
      ro.disconnect();
      eng.destroy();
      clearEngine();
      setEngineState(null);
    };
  }, []);

  // drag & drop images
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      const rect = host.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      readFileAsDataURL(file).then((dataURL) => {
        const img = new Image();
        img.onload = () => {
          const view = useStore.getState().doc.scene.view;
          const wx = (sx - view.scrollX) / view.zoom;
          const wy = (sy - view.scrollY) / view.zoom;
          setPendingImage({ dataURL, width: img.naturalWidth, height: img.naturalHeight });
          const s = useStore.getState();
          const el = makeImage(wx - 90, wy - 60, dataURL, img.naturalWidth, img.naturalHeight, { ...s.activeStyle });
          s.addElements([el]);
          s.select([el.id]);
        };
        img.src = dataURL;
      });
    };
    host.addEventListener("dragover", onDragOver);
    host.addEventListener("drop", onDrop);
    return () => {
      host.removeEventListener("dragover", onDragOver);
      host.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="canvas-host" ref={hostRef}>
      <canvas ref={canvasRef} />
      {!hasElements && <EmptyState />}
      {editingTextId && engine && <TextEditor id={editingTextId} />}
      <Minimap engine={engine} />
    </div>
  );
}