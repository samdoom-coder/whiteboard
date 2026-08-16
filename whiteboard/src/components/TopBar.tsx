import { useState, useCallback } from "react";
import { useStore } from "../core/store";
import { Icon } from "./Icon";
import { getEngine } from "../render/engineRegistry";
import { SettingsPopover } from "./SettingsPopover";
import { TemplatesPopover } from "./TemplatesMenu";
import { ExportDialog } from "./ExportDialog";

export function TopBar() {
  const doc = useStore((s) => s.doc);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const saveStatus = useStore((s) => s.saveStatus);
  const canUndo = useStore((s) => s.historyPast.length > 0);
  const canRedo = useStore((s) => s.historyFuture.length > 0);
  const setCanvasName = useStore((s) => s.setCanvasName);
  const setPopoverOpen = useStore((s) => s.setPopoverOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const toggleSettings = () => {
    const v = !settingsOpen;
    setSettingsOpen(v);
    setPopoverOpen(v);
  };

  const toggleTemplates = () => {
    const v = !templatesOpen;
    setTemplatesOpen(v);
    setPopoverOpen(v);
  };

  const onExport = useCallback(() => {
    setExportOpen(true);
    setSettingsOpen(false);
    setPopoverOpen(false);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="brand-logo">
          <Icon name="spark" size={17} />
        </div>
        <span className="brand-name">Scribble</span>
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
        <div className="tooltip-wrap">
          <button className="btn btn-icon" onClick={toggleTemplates} title="Templates" aria-label="Templates">
            <Icon name="template" />
          </button>
          <TemplatesPopover open={templatesOpen} onClose={() => { setTemplatesOpen(false); setPopoverOpen(false); }} />
        </div>
        <button className="btn btn-icon" onClick={onExport} title="Export (PNG / SVG / JSON)" aria-label="Export">
          <Icon name="download" />
        </button>
        <button className="btn btn-icon" onClick={toggleSettings} title="Settings" aria-label="Settings">
          <Icon name="settings" />
        </button>
        <button className="btn btn-icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Toggle theme" aria-label="Toggle theme">
          <Icon name={theme === "light" ? "moon" : "sun"} />
        </button>
        {settingsOpen && (
          <div className="popover floating panel-enter" onClick={(e) => e.stopPropagation()}>
            <SettingsPopover onExport={onExport} />
          </div>
        )}
      </div>
      <span className="save-status" style={{ position: "absolute", right: 12, bottom: -20 }}>
        <span className={`dot ${saveStatus}`} />
        {saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Offline" : "Saving…"}
      </span>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
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