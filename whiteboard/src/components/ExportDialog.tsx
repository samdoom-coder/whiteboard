import { useRef, useState } from "react";
import { useStore } from "../core/store";
import { exportToPNG, exportToSVG, downloadBlob, importFromJSON, downloadJSON } from "../export";
import { Icon } from "./Icon";
import type { ExportSettings } from "../types";
import { getEngine } from "../render/engineRegistry";

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const theme = useStore((s) => s.theme);
  const selectedIds = useStore((s) => s.selectedIds);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<ExportSettings>({
    scale: 2,
    transparentBackground: false,
    background: doc.scene.backgroundColor,
    onlySelected: false,
  });

  if (!open) return null;

  const hasSelection = selectedIds.length > 0;
  const elements = settings.onlySelected
    ? doc.elements.filter((e) => selectedIds.includes(e.id))
    : doc.elements;

  const name = doc.scene.name.replace(/\s+/g, "-").toLowerCase() || "whiteboard";

  const doPNG = async () => {
    setBusy(true);
    try {
      const url = await exportToPNG(elements, settings, theme, doc.scene.backgroundColor);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  const doSVG = () => {
    const svg = exportToSVG(elements, settings, theme, doc.scene.backgroundColor);
    downloadBlob(svg, `${name}.svg`, "image/svg+xml");
  };

  const doJSON = () => downloadJSON(doc, settings.onlySelected, selectedIds);

  const onImport = async (file: File | null) => {
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = importFromJSON(text);
      if (!parsed) {
        setImportError("This file doesn't look like a valid Scribble document.");
        return;
      }
      useStore.getState().resetFromDocument(parsed);
      requestAnimationFrame(() => getEngine().fitToScreen());
      onClose();
    } catch {
      setImportError("Couldn't read the file.");
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal dialog panel-enter" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title">Export & import</div>
        </div>
        <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {hasSelection && (
            <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.onlySelected}
                onChange={(e) => setSettings({ ...settings, onlySelected: e.target.checked })}
              />
              Only selected elements ({selectedIds.length})
            </label>
          )}

          <div className="style-section">
            <span className="style-label">Scale</span>
            <div className="seg">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  className={`btn ${settings.scale === s ? "active" : ""}`}
                  onClick={() => setSettings({ ...settings, scale: s })}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="style-section">
            <span className="style-label">Background</span>
            <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!settings.transparentBackground}
                onChange={(e) => setSettings({ ...settings, transparentBackground: !e.target.checked })}
              />
              Include canvas background color
            </label>
          </div>

          <div className="style-section">
            <span className="style-label">Download</span>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={busy || !elements.length} onClick={doPNG}>
                <Icon name="image" size={15} />
                {busy ? "Rendering…" : "PNG"}
              </button>
              <button className="btn" disabled={!elements.length} onClick={doSVG}>
                <Icon name="pencil" size={15} />
                SVG
              </button>
              <button className="btn" onClick={doJSON}>
                <Icon name="download" size={15} />
                JSON
              </button>
            </div>
            {!elements.length && (
              <span className="style-label">Nothing on the canvas to export yet.</span>
            )}
          </div>

          <div className="style-section">
            <span className="style-label">Import</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn" onClick={() => importRef.current?.click()}>
                <Icon name="download" size={15} style={{ transform: "rotate(180deg)" }} />
                Load JSON…
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (confirm("Clear the current canvas and start fresh?")) {
                    useStore.getState().clearCanvas();
                  }
                }}
              >
                New canvas
              </button>
            </div>
            {importError && <span className="style-label" style={{ color: "var(--danger)" }}>{importError}</span>}
          </div>
        </div>
        <div className="dialog-body" style={{ padding: "10px 20px", borderTop: "1px solid var(--border)" }}>
          <button className="btn" style={{ marginLeft: "auto", display: "block" }} onClick={onClose}>
            Close
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            onImport(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}