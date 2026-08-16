import { useRef } from "react";
import { useStore } from "../core/store";
import { toolDefinitions } from "../tools";
import { Icon } from "./Icon";
import { setPendingImage } from "../tools/ImageTool";

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups: Array<Array<typeof toolDefinitions[number]>> = [
    toolDefinitions.slice(0, 1), // selection
    toolDefinitions.slice(1, 5), // shapes
    toolDefinitions.slice(5, 8), // line, arrow, pencil
    toolDefinitions.slice(8, 10), // text, image
    toolDefinitions.slice(10), // eraser, hand
  ];

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

  return (
    <>
      <div className="mobile-toolbar floating panel-enter">
        {toolDefinitions.map((def) => (
          <div className="tooltip-wrap" key={def.id}>
            <button
              className={`btn btn-icon ${tool === def.id ? "active" : ""}`}
              onClick={() => {
                if (def.id === "image") fileRef.current?.click();
                else setTool(def.id);
              }}
              aria-label={def.label}
            >
              <Icon name={def.icon} size={19} />
            </button>
          </div>
        ))}
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