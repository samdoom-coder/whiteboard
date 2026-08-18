import { useState } from "react";
import { useStore } from "../core/store";
import { Icon } from "./Icon";
import { getEngine } from "../render/engineRegistry";
import { HamburgerMenu } from "./HamburgerMenu";
import { CollaborationMenu } from "./CollaborationMenu";

export function TopBar() {
  const doc = useStore((s) => s.doc);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const saveStatus = useStore((s) => s.saveStatus);
  const canUndo = useStore((s) => s.historyPast.length > 0);
  const canRedo = useStore((s) => s.historyFuture.length > 0);
  const setCanvasName = useStore((s) => s.setCanvasName);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="brand-logo">
          <img src="/favicon.png" alt="logo" style={{width: 30, height: 30}} />
        </div>
        <span className="brand-name">Whiteboard</span>
        {editingName ? (
          <input
            className="doc-name-input"
            autoFocus
            defaultValue={doc.scene.name}
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              borderRadius: 8,
              padding: "3px 8px",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
              maxWidth: 200,
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) setCanvasName(v);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <button
            className="btn doc-name"
            title="Rename canvas"
            onClick={() => setEditingName(true)}
          >
            {doc.scene.name}
          </button>
        )}
      </div>

      <div className="topbar-center">
        <ZoomGroup />
      </div>

      <div className="bar-group desktop-only">
        <button className="btn btn-icon" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Icon name="undo" />
        </button>
        <button className="btn btn-icon" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Icon name="redo" />
        </button>
      </div>
      <div className="bar-group">
        <CollaborationMenu open={collabOpen} onToggle={setCollabOpen} />
      </div>
      <div className="bar-group">
        <HamburgerMenu open={menuOpen} onToggle={setMenuOpen} />
      </div>
      <span className="save-status" style={{ position: "absolute", right: 12, bottom: -20 }}>
        <span className={`dot ${saveStatus}`} />
        {saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Offline" : "Saving…"}
      </span>
    </div>
  );
}

export function ZoomGroup() {
  const view = useStore((s) => s.doc.scene.view);
  const engine = getEngine;
  return (
    <div className="bar-group">
      <button className="btn btn-icon" onClick={() => engine().zoomOut()} title="Zoom out" aria-label="Zoom out">
        <Icon name="minus" size={16} />
      </button>
      <button className="zoom-pct" onClick={() => engine().resetZoom()} title="Reset to 100%">
        {Math.round(view.zoom * 100)}%
      </button>
      <button className="btn btn-icon" onClick={() => engine().zoomIn()} title="Zoom in" aria-label="Zoom in">
        <Icon name="plus" size={16} />
      </button>
      <div style={{ width: 1, height: 18, background: "var(--border)", margin: "2px 2px" }} />
      <button className="btn btn-icon" onClick={() => engine().fitToScreen()} title="Fit to screen" aria-label="Fit to screen">
        <Icon name="fit-to-screen" size={16} />
      </button>
    </div>
  );
}