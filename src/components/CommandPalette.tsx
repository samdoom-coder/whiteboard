import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../core/store";
import { Icon } from "./Icon";
import { getEngine } from "../render/engineRegistry";
import { setPendingImage } from "../tools/ImageTool";
import { readFileToImage } from "../util/image";

interface Command {
  id: string;
  title: string;
  keywords: string;
  icon: string;
  action: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const s = useStore.getState();
    const e = getEngine;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    const pickImage = () => {
      fileInput.onchange = async () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        const img = await readFileToImage(f);
        setPendingImage({ dataURL: img.dataURL, width: img.width, height: img.height });
        useStore.getState().setTool("image");
      };
      fileInput.click();
    };
    return [
      { id: "rect", title: "Create rectangle", keywords: "rect shape box", icon: "rect", action: () => s.setTool("rectangle") },
      { id: "ellipse", title: "Create ellipse", keywords: "ellipse circle oval", icon: "ellipse", action: () => s.setTool("ellipse") },
      { id: "diamond", title: "Create diamond", keywords: "diamond rhombus", icon: "diamond", action: () => s.setTool("diamond") },
      { id: "arrow", title: "Create arrow", keywords: "arrow line connector", icon: "arrow", action: () => s.setTool("arrow") },
      { id: "text", title: "Add text", keywords: "text label", icon: "text", action: () => s.setTool("text") },
      { id: "sticky", title: "Add sticky note", keywords: "sticky note post-it label", icon: "sticky", action: () => s.setTool("sticky") },
      { id: "image", title: "Insert image…", keywords: "image picture photo", icon: "image", action: pickImage },
      { id: "pencil", title: "Draw freehand", keywords: "pencil sketch draw pen", icon: "pencil", action: () => s.setTool("pencil") },
      { id: "hand", title: "Pan (hand tool)", keywords: "hand pan move", icon: "hand", action: () => s.setTool("hand") },
      { id: "selectall", title: "Select all", keywords: "select all everything", icon: "cursor", action: () => s.selectAll() },
      { id: "delete", title: "Delete selected", keywords: "delete remove trash", icon: "trash", action: () => s.deleteSelected() },
      { id: "duplicate", title: "Duplicate selected", keywords: "duplicate copy clone", icon: "copy", action: () => s.duplicateSelected() },
      { id: "front", title: "Bring to front", keywords: "front layer bring z-order", icon: "bringToFront", action: () => s.bringToFront() },
      { id: "back", title: "Send to back", keywords: "back layer send z-order", icon: "sendToBack", action: () => s.sendToBack() },
      { id: "undo", title: "Undo", keywords: "undo revert back", icon: "undo", action: () => s.undo() },
      { id: "redo", title: "Redo", keywords: "redo forward", icon: "redo", action: () => s.redo() },
      { id: "png", title: "Export PNG", keywords: "export png image save", icon: "download", action: () => runExport("png") },
      { id: "svg", title: "Export SVG", keywords: "export svg vector save", icon: "download", action: () => runExport("svg") },
      { id: "json", title: "Export JSON", keywords: "export json save backup", icon: "download", action: () => runExport("json") },
      { id: "fit", title: "Zoom to fit", keywords: "fit zoom screen all", icon: "fit-to-screen", action: () => e().fitToScreen() },
      { id: "selzoom", title: "Zoom to selection", keywords: "zoom selection focus", icon: "search", action: () => e().zoomToSelection() },
      { id: "grid", title: "Toggle grid", keywords: "grid background lines", icon: "grid", action: () => s.setScene({ background: s.doc.scene.background === "grid" ? "none" : "grid" }) },
      { id: "dots", title: "Toggle dots", keywords: "dots background points", icon: "dots", action: () => s.setScene({ background: s.doc.scene.background === "dots" ? "none" : "dots" }) },
      { id: "dark", title: "Toggle dark mode", keywords: "dark theme mode night", icon: "moon", action: () => s.setTheme(s.theme === "light" ? "dark" : "light") },
      { id: "clear", title: "Clear canvas", keywords: "clear reset wipe new", icon: "trash", action: () => { if (confirm("Clear the entire canvas? This can be undone.")) s.clearCanvas(); } },
      { id: "shortcuts", title: "Show keyboard shortcuts", keywords: "shortcuts help keys", icon: "keyboard", action: () => window.dispatchEvent(new CustomEvent("scribble:shortcuts")) },
      { id: "ai", title: "Open AI assistant", keywords: "ai assistant generate", icon: "sparkle", action: () => openAI() },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const c = filtered[index];
        if (c) {
          c.action();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, index]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.title + " " + c.keywords).toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal panel-enter" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <span style={{ paddingLeft: 16, color: "var(--text-muted)", display: "grid", placeItems: "center" }}>
            <Icon name="search" size={16} />
          </span>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
          />
        </div>
        <div className="palette-list">
          {filtered.slice(0, 14).map((c, i) => (
            <button
              key={c.id}
              className={`palette-item ${i === index ? "selected" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                c.action();
                onClose();
              }}
            >
              <Icon name={c.icon} size={15} />
              {c.title}
            </button>
          ))}
          {!filtered.length && (
            <div className="palette-hint">No commands match “{query}”.</div>
          )}
        </div>
        <div className="palette-hint">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> dismiss</span>
        </div>
      </div>
    </div>
  );
}

const runExport = (kind: "png" | "svg" | "json") => {
  window.dispatchEvent(new CustomEvent("scribble:export", { detail: { kind } }));
};

const openAI = () => {
  window.dispatchEvent(new CustomEvent("scribble:ai"));
};