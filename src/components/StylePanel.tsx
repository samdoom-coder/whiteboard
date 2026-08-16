import { useStore } from "../core/store";
import type { Element, FillStyle, StrokeStyle, TextElement } from "../types";
import { elementColors } from "../util/color";
import { textFonts } from "../util/font";
import { resizeTextElement } from "../render/renderer";
import { Icon } from "./Icon";

const strokeSwatches = elementColors.strokes;
const fillSwatches = elementColors.fills;

type StylePatch = Partial<{
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  roughness: number;
  roundness: number;
}>;

export function StylePanel() {
  return (
    <div className="style-panel floating panel-enter">
      <StylePanelContent />
    </div>
  );
}

export function StylePanelContent() {
  const selectedIds = useStore((s) => s.selectedIds);
  const activeStyle = useStore((s) => s.activeStyle);
  const setActiveStyle = useStore((s) => s.setActiveStyle);
  const elements = useStore((s) => s.doc.elements);
  const selected = selectedIds.map((id) => elements.find((e) => e.id === id)).filter(Boolean) as Element[];

  const hasSelection = selected.length > 0;
  const source = hasSelection ? selected[0] : activeStyle;
  const isText = hasSelection && selected[0].type === "text";
  const textEl = isText ? (selected[0] as TextElement) : null;

  const apply = (style: StylePatch) => {
    // choosing a fill color should fill solid by default
    let patch = style;
    if (style.backgroundColor !== undefined && style.backgroundColor !== "transparent") {
      patch = { ...style, fillStyle: "solid" };
    }
    if (hasSelection) {
      const s = useStore.getState();
      s.beginGesture();
      const ids = new Set(s.selectedIds);
      const next = s.doc.elements.map((el) => (ids.has(el.id) ? { ...el, ...patch } : el));
      s.setElementsLive(next);
      s.commit();
    }
    // remember as the default style for new shapes
    setActiveStyle(patch);
  };

  const applyText = (patch: Partial<Pick<TextElement, "fontSize" | "fontFamily" | "textAlign" | "textBold">>) => {
    const s = useStore.getState();
    s.beginGesture();
    const ids = new Set(s.selectedIds);
    const next = s.doc.elements.map((el) =>
      ids.has(el.id) && el.type === "text"
        ? resizeTextElement({ ...(el as TextElement), ...patch })
        : el,
    );
    s.setElementsLive(next);
    s.commit();
  };

  const swatch = (c: string) => ({
    background: c,
    ...(c === "transparent" ? {} : {}),
  });

  return (
    <div className="style-panel-content">
      {hasSelection && (
        <div className="style-section">
          <span className="style-label">
            {selected.length === 1
              ? `Selected ${selected[0].type}`
              : `${selected.length} elements selected`}
          </span>
        </div>
      )}
      {!hasSelection && (
        <div className="style-section">
          <span className="style-label">Default style for new shapes</span>
        </div>
      )}

      {isText && textEl && (
        <div className="style-section">
          <span className="style-label">Text font</span>
          <div className="font-list">
            {textFonts.map((f) => (
              <button
                key={f.id}
                className={`font-option ${textEl.fontFamily === f.family ? "active" : ""}`}
                style={{ fontFamily: f.family }}
                title={f.label}
                onClick={() => applyText({ fontFamily: f.family })}
              >
                Aa
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="style-label" style={{ textTransform: "none", letterSpacing: 0 }}>
              Size · {textEl.fontSize}px
            </span>
            <input
              type="range"
              min={10}
              max={72}
              value={textEl.fontSize}
              style={{ flex: 1 }}
              onChange={(e) => applyText({ fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="row" style={{ gap: 6 }}>
            <div className="seg" style={{ flex: 1 }}>
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  className={`btn ${textEl.textAlign === a ? "active" : ""}`}
                  onClick={() => applyText({ textAlign: a })}
                >
                  {a === "left" ? "Left" : a === "center" ? "Center" : "Right"}
                </button>
              ))}
            </div>
            <button
              className={`btn ${textEl.textBold ? "active" : ""}`}
              onClick={() => applyText({ textBold: !textEl.textBold })}
            >
              <Icon name="pencil" size={14} />
              Bold
            </button>
          </div>
        </div>
      )}

      <div className="style-section">
        <span className="style-label">Stroke</span>
        <div className="swatches">
          {strokeSwatches.map((c) => (
            <button
              key={c}
              className={`swatch ${source.strokeColor === c ? "active" : ""}`}
              style={swatch(c)}
              onClick={() => apply({ strokeColor: c })}
            />
          ))}
          <label className="swatch" style={{ ...swatch("#000000"), display: "grid", placeItems: "center", cursor: "pointer" }}>
            <input
              type="color"
              value={source.strokeColor.startsWith("#") ? source.strokeColor : "#000000"}
              onChange={(e) => apply({ strokeColor: e.target.value })}
              style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
            />
            <Icon name="spark" size={12} />
          </label>
        </div>
      </div>

      {!isText && (
        <div className="style-section">
          <span className="style-label">Fill</span>
          <div className="swatches">
            {fillSwatches.map((c) => (
              <button
                key={c}
                className={`swatch ${c === "transparent" ? "transparent" : ""} ${source.backgroundColor === c ? "active" : ""}`}
                style={c === "transparent" ? {} : swatch(c)}
                onClick={() => apply({ backgroundColor: c })}
              />
            ))}
            <label className="swatch" style={{ ...swatch("#ffffff"), display: "grid", placeItems: "center", cursor: "pointer" }}>
              <input
                type="color"
                value={source.backgroundColor.startsWith("#") ? source.backgroundColor : "#ffffff"}
                onChange={(e) => apply({ backgroundColor: e.target.value })}
                style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
              />
              <Icon name="spark" size={12} />
            </label>
          </div>
        </div>
      )}

      {!isText && (
        <div className="style-section">
          <span className="style-label">Fill pattern</span>
          <div className="seg">
            {(["solid", "hachure", "crosshatch"] as FillStyle[]).map((f) => (
              <button key={f} className={`btn ${source.fillStyle === f ? "active" : ""}`} onClick={() => apply({ fillStyle: f })}>
                {f === "solid" ? "Solid" : f === "hachure" ? "Sketch" : "Cross"}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isText && (
        <div className="style-section">
          <span className="style-label">Stroke style</span>
          <div className="seg">
            {(["solid", "dashed", "dotted"] as StrokeStyle[]).map((s) => (
              <button key={s} className={`btn ${source.strokeStyle === s ? "active" : ""}`} onClick={() => apply({ strokeStyle: s })}>
                {s === "solid" ? "Solid" : s === "dashed" ? "Dashed" : "Dotted"}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isText && (
        <div className="style-section">
          <span className="style-label">Stroke width · {source.strokeWidth}px</span>
          <input
            type="range"
            min={1}
            max={10}
            value={source.strokeWidth}
            onChange={(e) => apply({ strokeWidth: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="style-section">
        <span className="style-label">Opacity · {Math.round(source.opacity * 100)}%</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={source.opacity}
          onChange={(e) => apply({ opacity: Number(e.target.value) })}
        />
      </div>

      {!isText && (
        <div className="style-section">
          <span className="style-label">Roughness · {source.roughness.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={source.roughness}
            onChange={(e) => apply({ roughness: Number(e.target.value) })}
          />
        </div>
      )}

      {!isText && source.roundness != null && (
        <div className="style-section">
          <span className="style-label">Roundness · {Math.round(source.roundness * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={source.roundness}
            onChange={(e) => apply({ roundness: Number(e.target.value) })}
          />
        </div>
      )}

      {!isText && <LayerControls hasSelection={hasSelection} />}
    </div>
  );
}

function LayerControls({ hasSelection }: { hasSelection: boolean }) {
  const s = useStore.getState();
  const can = hasSelection && s.selectedIds.length > 0;
  const actions = [
    { label: "Bring forward", icon: "bringForward", fn: s.bringForward },
    { label: "Send backward", icon: "sendBackward", fn: s.sendBackward },
    { label: "Bring to front", icon: "bringToFront", fn: s.bringToFront },
    { label: "Send to back", icon: "sendToBack", fn: s.sendToBack },
  ];
  return (
    <div className="style-section">
      <span className="style-label">Layer order</span>
      <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
        {actions.map((a) => (
          <button key={a.label} className="btn btn-icon" disabled={!can} onClick={a.fn} title={a.label}>
            <Icon name={a.icon} size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}