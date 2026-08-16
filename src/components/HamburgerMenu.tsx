import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { Icon } from "./Icon";
import { CanvasSettingsContent } from "./SettingsPopover";
import { templates } from "../templates";
import { getEngine } from "../render/engineRegistry";
import { exportToPNG, exportToSVG, downloadBlob, downloadJSON } from "../export";
import type { ExportSettings } from "../types";

interface Props {
  open: boolean;
  onToggle: (v: boolean) => void;
}

export function HamburgerMenu({ open, onToggle }: Props) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const doc = useStore((s) => s.doc);
  const resetFromDocument = useStore((s) => s.resetFromDocument);
  const clearCanvas = useStore((s) => s.clearCanvas);
  const save = useStore((s) => s.save);
  const saveStatus = useStore((s) => s.saveStatus);
  const setPopoverOpen = useStore((s) => s.setPopoverOpen);
  const ref = useRef<HTMLDivElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyPng, setBusyPng] = useState(false);

  // keep the standalone style panel hidden while this menu is open (avoid overlap)
  useEffect(() => {
    setPopoverOpen(open);
  }, [open, setPopoverOpen]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  const name = doc.scene.name.replace(/\s+/g, "-").toLowerCase() || "whiteboard";

  const quickSettings: ExportSettings = {
    scale: 2,
    transparentBackground: false,
    background: doc.scene.backgroundColor,
    onlySelected: false,
  };

  const doPNG = async () => {
    setBusyPng(true);
    try {
      const s = useStore.getState();
      const url = await exportToPNG(s.doc.elements, quickSettings, s.theme, s.doc.scene.backgroundColor);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.png`;
      a.click();
    } finally {
      setBusyPng(false);
    }
  };

  const doSVG = () => {
    const s = useStore.getState();
    const svg = exportToSVG(s.doc.elements, quickSettings, s.theme, s.doc.scene.backgroundColor);
    downloadBlob(svg, `${name}.svg`, "image/svg+xml");
  };

  const doJSON = () => {
    const s = useStore.getState();
    downloadJSON(s.doc, false, []);
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (!t) return;
    const elements = t.build();
    const nextDoc = {
      ...doc,
      name: t.name,
      scene: { ...doc.scene, name: t.name },
      elements,
      updatedAt: Date.now(),
    };
    resetFromDocument(nextDoc);
    requestAnimationFrame(() => getEngine().fitToScreen());
    onToggle(false);
  };

  const action = (icon: string, label: string, fn: () => void) => (
    <button
      className="hamburger-action"
      onClick={() => {
        fn();
        onToggle(false);
      }}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );

  const sectionTitle = (icon: string, label: string) => (
    <div className="hamburger-section-title">
      <Icon name={icon} size={13} />
      {label}
    </div>
  );

  const saveDotColor =
    saveStatus === "saved"
      ? "#51cf66"
      : saveStatus === "error"
        ? "#ff6b6b"
        : saveStatus === "saving"
          ? "#ffa94d"
          : "#ffa94d";
  const saveLabel =
    saveStatus === "saved"
      ? "All changes saved"
      : saveStatus === "error"
        ? "Offline — will retry"
        : "Unsaved changes";

  return (
    <div className="hamburger-wrap" ref={ref}>
      <button
        className="btn btn-icon"
        onClick={() => onToggle(!open)}
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
      >
        <Icon name={open ? "close" : "menu"} size={18} />
      </button>
      {open && (
        <div className="popover hamburger-menu floating panel-enter" onClick={(e) => e.stopPropagation()}>
          <div className="hamburger-menu-head">
            <span className="hamburger-menu-title">Menu</span>
            <button className="btn btn-icon" onClick={() => onToggle(false)} aria-label="Close menu">
              <Icon name="close" size={15} />
            </button>
          </div>

          <div className="hamburger-section">
            {sectionTitle("template", "Templates")}
            <div className="template-grid" style={{ padding: 0 }}>
              {templates.map((t) => (
                <button key={t.id} className="template-card" onClick={() => applyTemplate(t.id)}>
                  <div className="template-name">
                    <Icon name="template" size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
                    {t.name}
                  </div>
                  <div className="template-desc">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="hamburger-section">
            {sectionTitle("settings", "Canvas settings")}
            <CanvasSettingsContent />
          </div>

          <div className="hamburger-section">
            {sectionTitle("download", "Export")}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={busyPng || !doc.elements.length} onClick={doPNG}>
                <Icon name="image" size={14} />
                {busyPng ? "Rendering…" : "PNG"}
              </button>
              <button className="btn" disabled={!doc.elements.length} onClick={doSVG}>
                <Icon name="pencil" size={14} />
                SVG
              </button>
              <button className="btn" onClick={doJSON}>
                <Icon name="download" size={14} />
                JSON
              </button>
            </div>
            <button
              className="btn"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("scribble:export"));
                onToggle(false);
              }}
            >
              <Icon name="share" size={14} />
              Export dialog…
            </button>
            {!doc.elements.length && <span className="style-label">Nothing on the canvas to export yet.</span>}
          </div>

          <div className="hamburger-section">
            {sectionTitle("save", "Save")}
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="style-label">
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    marginRight: 6,
                    verticalAlign: 1,
                    background: saveDotColor,
                  }}
                />
                {saveLabel}
              </span>
              <button className="btn" onClick={save}>
                <Icon name="save" size={14} />
                Save now
              </button>
            </div>
          </div>

          <div className="hamburger-section">
            {sectionTitle("sparkle", "Actions")}
            <div className="hamburger-actions">
              {action("rect", "New canvas", () => {
                if (confirm("Clear the current canvas and start fresh?")) clearCanvas();
              })}
              {action("keyboard", "Keyboard shortcuts", () => window.dispatchEvent(new CustomEvent("scribble:shortcuts")))}
              {action("sparkle", "AI assistant", () => window.dispatchEvent(new CustomEvent("scribble:ai")))}
              {action(theme === "light" ? "moon" : "sun", theme === "light" ? "Dark mode" : "Light mode", () =>
                setTheme(theme === "light" ? "dark" : "light"),
              )}
            </div>
            {confirmClear ? (
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn danger"
                  onClick={() => {
                    clearCanvas();
                    setConfirmClear(false);
                    onToggle(false);
                  }}
                >
                  <Icon name="trash" size={14} />
                  Yes, clear
                </button>
                <button className="btn" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn danger" onClick={() => setConfirmClear(true)}>
                <Icon name="trash" size={14} />
                Clear canvas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}