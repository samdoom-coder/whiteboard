import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { overflowToolIds, toolDefinitions } from "../tools";
import { Icon } from "./Icon";
import { setPendingImage } from "../tools/ImageTool";

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const overflowDefs = () => toolDefinitions.filter((t) => overflowToolIds.includes(t.id));
const isOverflow = (id: string) => overflowToolIds.includes(id as never);

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const fileRef = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const mainDefs = toolDefinitions.filter((t) => !isOverflow(t.id));
  const extraDefs = overflowDefs();
  const activeExtra = extraDefs.find((t) => t.id === tool);

  const groups: Array<Array<typeof toolDefinitions[number]>> = [
    mainDefs.filter((t) => t.id === "selection"),
    mainDefs.filter((t) => ["rectangle", "roundedRectangle", "ellipse", "diamond"].includes(t.id)),
    mainDefs.filter((t) => ["line", "arrow", "pencil"].includes(t.id)),
    mainDefs.filter((t) => ["text", "sticky", "image"].includes(t.id)),
    mainDefs.filter((t) => ["eraser", "hand"].includes(t.id)),
  ];

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const onImage = async (file: File | null) => {
    if (!file) return;
    const dataURL = await readFileAsDataURL(file);
    const img = new Image();
    img.onload = () => {
      setPendingImage({ dataURL, width: img.naturalWidth, height: img.naturalHeight });
      setTool("image");
    };
    img.src = dataURL;
  };

  const onToolClick = (id: string) => {
    if (id === "image") {
      fileRef.current?.click();
      return;
    }
    setTool(id as never);
    if (isOverflow(id)) setMoreOpen(false);
  };

  return (
    <>
      <div className="toolbar floating panel-enter">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="toolbar-divider" />}
            {group.map((def) => (
              <div className="tooltip-wrap" key={def.id}>
                <button
                  className={`btn btn-icon ${tool === def.id ? "active" : ""}`}
                  onClick={() => onToolClick(def.id)}
                  aria-label={def.label}
                >
                  <Icon name={def.icon} size={19} />
                </button>
                <span className="tooltip">
                  {def.label}
                  {def.shortcut && <kbd>{def.shortcut}</kbd>}
                </span>
              </div>
            ))}
          </div>
        ))}
        {extraDefs.length > 0 && (
          <div ref={moreRef} className="toolbar-more-wrap">
            <div className="toolbar-divider" />
            <div className="tooltip-wrap">
              <button
                className={`btn btn-icon ${activeExtra ? "active" : ""} ${moreOpen ? "open" : ""}`}
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More tools"
                aria-expanded={moreOpen}
              >
                <Icon name={activeExtra ? activeExtra.icon : "more"} size={19} />
                {activeExtra && <span className="more-active-dot" />}
              </button>
              <span className="tooltip">
                More tools
              </span>
            </div>
            {moreOpen && (
              <div className="toolbar-more-popover floating" role="menu" aria-label="More tools">
                {extraDefs.map((def) => (
                  <button
                    key={def.id}
                    className={`more-item ${tool === def.id ? "active" : ""}`}
                    onClick={() => onToolClick(def.id)}
                    role="menuitem"
                    title={def.shortcut ? `${def.label} (${def.shortcut})` : def.label}
                  >
                    <Icon name={def.icon} size={18} />
                    <span className="more-item-label">{def.label}</span>
                    {def.shortcut && <kbd>{def.shortcut}</kbd>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          onImage(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function MobileToolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const fileRef = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const mainDefs = toolDefinitions.filter((t) => !isOverflow(t.id));
  const extraDefs = overflowDefs();
  const activeExtra = extraDefs.find((t) => t.id === tool);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [moreOpen]);

  const onImage = async (file: File | null) => {
    if (!file) return;
    const dataURL = await readFileAsDataURL(file);
    const img = new Image();
    img.onload = () => {
      setPendingImage({ dataURL, width: img.naturalWidth, height: img.naturalHeight });
      setTool("image");
    };
    img.src = dataURL;
  };

  const onToolClick = (id: string) => {
    if (id === "image") {
      fileRef.current?.click();
      return;
    }
    setTool(id as never);
    if (isOverflow(id)) setMoreOpen(false);
  };

  return (
    <>
      <div className="mobile-toolbar floating panel-enter">
        {mainDefs.map((def) => (
          <div className="tooltip-wrap" key={def.id}>
            <button
              className={`btn btn-icon ${tool === def.id ? "active" : ""}`}
              onClick={() => onToolClick(def.id)}
              aria-label={def.label}
            >
              <Icon name={def.icon} size={19} />
            </button>
          </div>
        ))}
        {extraDefs.length > 0 && (
          <div ref={moreRef} className="toolbar-more-wrap">
            <button
              className={`btn btn-icon ${activeExtra ? "active" : ""}`}
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More tools"
              aria-expanded={moreOpen}
            >
              <Icon name={activeExtra ? activeExtra.icon : "more"} size={19} />
            </button>
            {moreOpen && (
              <div className="toolbar-more-popover floating mobile" role="menu" aria-label="More tools">
                {extraDefs.map((def) => (
                  <button
                    key={def.id}
                    className={`more-item ${tool === def.id ? "active" : ""}`}
                    onClick={() => onToolClick(def.id)}
                    role="menuitem"
                  >
                    <Icon name={def.icon} size={18} />
                    <span className="more-item-label">{def.label}</span>
                    {def.shortcut && <kbd>{def.shortcut}</kbd>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          onImage(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}
