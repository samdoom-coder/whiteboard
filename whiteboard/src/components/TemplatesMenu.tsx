import { useStore } from "../core/store";
import { templates } from "../templates";
import { getEngine } from "../render/engineRegistry";
import { Icon } from "./Icon";

export function TemplatesPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const resetFromDocument = useStore((s) => s.resetFromDocument);

  if (!open) return null;

  const apply = (id: string) => {
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
    onClose();
  };

  return (
    <div
      className="popover floating panel-enter"
      style={{ left: 0, right: "auto", minWidth: 360 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="style-label" style={{ marginBottom: 10 }}>Templates</div>
      <div className="template-grid" style={{ padding: 0 }}>
        {templates.map((t) => (
          <button key={t.id} className="template-card" onClick={() => apply(t.id)}>
            <div className="template-name">
              <Icon name="template" size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
              {t.name}
            </div>
            <div className="template-desc">{t.description}</div>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        <span className="style-label">Applying a template replaces the current canvas</span>
        <button className="btn btn-icon" onClick={onClose} aria-label="Close">
          <Icon name="close" size={15} />
        </button>
      </div>
    </div>
  );
}