import { useEffect, useState } from "react";
import { useStore } from "../core/store";
import { getEngine } from "../render/engineRegistry";
import { toolDefinitions } from "../tools";

export interface UIState {
  palette: boolean;
  setPalette: (v: boolean) => void;
  shortcuts: boolean;
  setShortcuts: (v: boolean) => void;
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
}

export function useKeyboardShortcuts(): UIState {
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const mod = e.ctrlKey || e.metaKey;
      const s = useStore.getState();

      // global UI toggles
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcuts(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
        return;
      }

      if (mod) {
        const k = e.key.toLowerCase();
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) s.redo();
          else s.undo();
          return;
        }
        if (k === "y") {
          e.preventDefault();
          s.redo();
          return;
        }
        if (k === "c") {
          s.copySelected();
          return;
        }
        if (k === "v") {
          const eng = getEngine();
          const view = s.doc.scene.view;
          const at = {
            x: (eng.viewport.width / 2 - view.scrollX) / view.zoom,
            y: (eng.viewport.height / 2 - view.scrollY) / view.zoom,
          };
          s.pasteClipboard(at);
          return;
        }
        if (k === "d") {
          e.preventDefault();
          s.duplicateSelected();
          return;
        }
        if (k === "a") {
          e.preventDefault();
          s.selectAll();
          return;
        }
        if (k === "0") {
          e.preventDefault();
          getEngine().resetZoom();
          return;
        }
        if (k === "=" || k === "+") {
          e.preventDefault();
          getEngine().zoomIn();
          return;
        }
        if (k === "-") {
          e.preventDefault();
          getEngine().zoomOut();
          return;
        }
        if (k === "s") {
          e.preventDefault();
          return;
        }
        return;
      }

      if (e.altKey) return;

      // tool shortcuts
      const tool = toolDefinitions.find((t) => t.shortcut && t.shortcut.toUpperCase() === e.key.toUpperCase());
      if (tool) {
        if (e.key === "r" && s.tool === "rectangle") {
          s.setTool("roundedRectangle");
        } else {
          s.setTool(tool.id);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // listen for events dispatched by the command palette
  useEffect(() => {
    const onExport = () => setExportOpen(true);
    const onAI = () => setAiOpen(true);
    const onShortcuts = () => setShortcuts(true);
    window.addEventListener("scribble:export", onExport);
    window.addEventListener("scribble:ai", onAI);
    window.addEventListener("scribble:shortcuts", onShortcuts);
    return () => {
      window.removeEventListener("scribble:export", onExport);
      window.removeEventListener("scribble:ai", onAI);
      window.removeEventListener("scribble:shortcuts", onShortcuts);
    };
  }, []);

  return { palette, setPalette, shortcuts, setShortcuts, exportOpen, setExportOpen, aiOpen, setAiOpen };
}