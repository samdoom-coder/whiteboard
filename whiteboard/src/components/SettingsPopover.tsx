import { useState } from "react";
import { useStore } from "../core/store";
import { Icon } from "./Icon";

export function SettingsPopover({ onExport }: { onExport: () => void }) {
  const doc = useStore((s) => s.doc);
  const setScene = useStore((s) => s.setScene);
  const clearCanvas = useStore((s) => s.clearCanvas);
  const [confirmClear, setConfirmClear] = useState(false);
  const backgrounds = [
    { id: "none" as const, label: "Plain", icon: "rect" },
    { id: "grid" as const, label: "Grid", icon: "grid" },
    { id: "dots" as const, label: "Dots", icon: "dots" },
  ];
  const bgColors = ["#faf9f5", "#ffffff", "#f1f3f5", "#e9ecef", "#fdf0d5", "#e7f5ff", "#e6fcf5", "#1c1b1a", "#24272e", "#101418"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="style-section">
        <span className="style-label">Canvas background</span>
        <div className="seg">
          {backgrounds.map((b) => (
            <button
              key={b.id}
              className={`btn ${doc.scene.background === b.id ? "active" : ""}`}
              onClick={() => setScene({ background: b.id })}
            >
              <Icon name={b.icon} size={14} />
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="style-section">
        <span className="style-label">Canvas color</span>
        <div className="bg-swatch-row">
          {bgColors.map((c) => (
            <button
              key={c}
              className={`bg-swatch ${doc.scene.backgroundColor === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => setScene({ backgroundColor: c })}
            />
          ))}
        </div>
      </div>
      <div className="style-section">
        <span className="style-label">Actions</span>
        <button className="btn" onClick={onExport}>
          <Icon name="download" size={15} />
          Export canvas
        </button>
        {confirmClear ? (
          <div className="row">
            <button className="btn danger" onClick={() => { clearCanvas(); setConfirmClear(false); }}>
              <Icon name="trash" size={14} />
              Yes, clear all
            </button>
            <button className="btn" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn danger" onClick={() => setConfirmClear(true)}>
            <Icon name="trash" size={15} />
            Clear canvas
          </button>
        )}
      </div>
    </div>
  );
}