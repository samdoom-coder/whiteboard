import { useEffect, useState } from "react";
import { useStore } from "../core/store";
import { hitTestElements } from "../render/geometry";
import { Icon } from "./Icon";
import type { Element } from "../types";

export function ContextMenu() {
  const [pos, setPos] = useState<{ x: number; y: number; hit: Element | null } | null>(null);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const host = (e.target as HTMLElement)?.closest?.(".canvas-host");
      const canvas = (e.target as HTMLElement)?.closest?.("canvas");
      if (!host || !canvas) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const s = useStore.getState();
      const view = s.doc.scene.view;
      const wx = (sx - view.scrollX) / view.zoom;
      const wy = (sy - view.scrollY) / view.zoom;
      const hit = hitTestElements(s.doc.elements, { x: wx, y: wy });
      if (hit) {
        if (!s.selectedIds.includes(hit.id)) s.select([hit.id]);
      }
      setPos({ x: e.clientX, y: e.clientY, hit });
    };
    const onClose = () => setPos(null);
    const onClick = () => setPos(null);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", (e) => e.key === "Escape" && onClose());
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("click", onClick);
    };
  }, []);

  if (!pos) return null;

  const s = useStore.getState();
  const hasSel = s.selectedIds.length > 0;

  const item = (label: string, icon: string, fn: () => void, disabled = false) => (
    <button className="btn" disabled={disabled} onClick={() => { fn(); setPos(null); }}>
      <Icon name={icon} size={14} />
      {label}
    </button>
  );

  return (
    <div className="context-menu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {item("Copy", "copy", () => s.copySelected(), !hasSel)}
      {item("Duplicate", "copy", () => s.duplicateSelected(), !hasSel)}
      {item("Delete", "trash", () => s.deleteSelected(), !hasSel)}
      <div className="context-sep" />
      {item("Bring to front", "bringToFront", () => s.bringToFront(), !hasSel)}
      {item("Send to back", "sendToBack", () => s.sendToBack(), !hasSel)}
      {!pos.hit && (
        <>
          <div className="context-sep" />
          {item("Paste", "copy", () => s.pasteClipboard())}
          {item("Select all", "cursor", () => s.selectAll())}
        </>
      )}
    </div>
  );
}