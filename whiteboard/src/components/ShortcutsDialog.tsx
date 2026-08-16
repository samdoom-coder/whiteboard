import { useStore } from "../core/store";
import { getEngine } from "../render/engineRegistry";
import { Icon } from "./Icon";
import { toolDefinitions } from "../tools";

const rows: Array<[string, string]> = [
  ["V / R / E / D / L / A / P / T / H", "Switch tool"],
  ["R again while Rectangle is active", "Toggle rounded rectangle"],
  ["Space (hold)", "Pan the canvas"],
  ["Middle mouse / wheel pan", "Pan the canvas"],
  ["Ctrl/Cmd + wheel", "Zoom"],
  ["Scroll wheel", "Zoom to cursor"],
  ["Delete / Backspace", "Delete selected"],
  ["Ctrl/Cmd + Z", "Undo"],
  ["Ctrl/Cmd + Shift + Z / Ctrl+Y", "Redo"],
  ["Ctrl/Cmd + C / V", "Copy / paste"],
  ["Ctrl/Cmd + D", "Duplicate"],
  ["Ctrl/Cmd + A", "Select all"],
  ["Ctrl/Cmd + 0", "Reset zoom"],
  ["Ctrl/Cmd + + / −", "Zoom in / out"],
  ["Ctrl/Cmd + K", "Command palette"],
  ["Ctrl/Cmd + E", "Export"],
  ["?", "Show this panel"],
  ["Esc", "Cancel / deselect / close"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal panel-enter" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title">Keyboard shortcuts</div>
          <button className="btn btn-icon" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="dialog-body" style={{ maxHeight: "50vh", overflow: "auto" }}>
          <div className="style-section">
            <span className="style-label">Tools</span>
            <table className="shortcut-table">
              <tbody>
                {toolDefinitions.map((t) => (
                  <tr key={t.id}>
                    <td className="kbd-cell">{t.shortcut || "—"}</td>
                    <td>{t.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="style-section">
            <span className="style-label">Actions</span>
            <table className="shortcut-table">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td className="kbd-cell">
                      {k.split("/").map((part, i) => (
                        <span key={i}>
                          {i > 0 && <span className="sep">/</span>}
                          {part.split(" + ").map((p, j) => (
                            <span key={j}>
                              {j > 0 && <span className="plus"> + </span>}
                              <kbd>{p}</kbd>
                            </span>
                          ))}
                        </span>
                      ))}
                    </td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ZoomControls() {
  const view = useStore((s) => s.doc.scene.view);
  const engine = getEngine;
  return (
    <div className="zoom-controls floating panel-enter">
      <button className="btn btn-icon" onClick={() => engine().zoomOut()} title="Zoom out" aria-label="Zoom out">
        <Icon name="minus" size={15} />
      </button>
      <button className="zoom-pct" onClick={() => engine().resetZoom()} title="Reset to 100%">
        {Math.round(view.zoom * 100)}%
      </button>
      <button className="btn btn-icon" onClick={() => engine().zoomIn()} title="Zoom in" aria-label="Zoom in">
        <Icon name="plus" size={15} />
      </button>
      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "2px 2px" }} />
      <button className="btn btn-icon" onClick={() => engine().fitToScreen()} title="Fit to screen" aria-label="Fit to screen">
        <Icon name="fit-to-screen" size={15} />
      </button>
    </div>
  );
}