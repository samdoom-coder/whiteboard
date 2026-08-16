import { useStore } from "../core/store";

export function EmptyState() {
  const hasElements = useStore((s) => s.doc.elements.length > 0);
  if (hasElements) return null;
  return (
    <div className="empty-state">
      <div className="empty-inner">
        <div className="empty-title">Start drawing</div>
        <div className="empty-hints">
          <span>Press <kbd>R</kbd> for rectangle</span>
          <span>Press <kbd>T</kbd> for text</span>
          <span>Press <kbd>A</kbd> for arrow</span>
          <span>Press <kbd>?</kbd> for shortcuts</span>
        </div>
      </div>
    </div>
  );
}