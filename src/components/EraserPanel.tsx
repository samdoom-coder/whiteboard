import { useEraser, ERASER_MIN, ERASER_MAX } from "../core/eraser";

/** Floating brush-size control, shown while the eraser tool is active. */
export function EraserPanel() {
  const size = useEraser((s) => s.size);
  const setSize = useEraser((s) => s.setSize);

  return (
    <div className="eraser-panel floating panel-enter" role="group" aria-label="Eraser size">
      <span className="style-label">Eraser</span>
      <div className="row" style={{ gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            flex: "none",
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              width: Math.max(4, Math.min(24, (size / ERASER_MAX) * 24)),
              height: Math.max(4, Math.min(24, (size / ERASER_MAX) * 24)),
              borderRadius: "50%",
              background: "var(--text)",
              display: "block",
            }}
          />
        </span>
        <input
          type="range"
          min={ERASER_MIN}
          max={ERASER_MAX}
          step={1}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          aria-label="Eraser brush size"
          style={{ width: 130 }}
        />
        <span className="row-label" style={{ flex: "none", minWidth: 30, textAlign: "right" }}>
          {size}px
        </span>
      </div>
    </div>
  );
}
