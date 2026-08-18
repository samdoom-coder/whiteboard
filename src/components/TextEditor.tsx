import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import type { StickyElement, TextElement } from "../types";
import { fitStickyElement, resizeTextElement, STICKY_PAD } from "../render/renderer";

type Editable = TextElement | StickyElement;

export function TextEditor({ id }: { id: string }) {
  const el = useStore((s) => s.doc.elements.find((e) => e.id === id) as Editable | undefined);
  const view = useStore((s) => s.doc.scene.view);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el?.text ?? "");
  const committedRef = useRef(false);

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, []);

  useEffect(() => {
    if (el) setValue(el.text);
  }, [el?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!el) return null;

  const isSticky = el.type === "sticky";
  const zoom = view.zoom;
  const cx = (el.x + el.width / 2) * zoom + view.scrollX;
  const cy = (el.y + el.height / 2) * zoom + view.scrollY;
  const w = Math.max(60, el.width * zoom);
  const h = Math.max(30, el.height * zoom);
  const angleDeg = (el.angle * 180) / Math.PI;

  const liveUpdate = (text: string) => {
    const s = useStore.getState();
    const current = s.doc.elements.find((e) => e.id === id) as Editable | undefined;
    if (!current) return;
    const base = { ...current, text };
    const next = current.type === "sticky" ? fitStickyElement(base as StickyElement) : resizeTextElement(base as TextElement);
    s.setElementsLive(s.doc.elements.map((e) => (e.id === id ? next : e)));
  };

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const s = useStore.getState();
    const current = s.doc.elements.find((e) => e.id === id) as Editable | undefined;
    if (current) {
      const finalText = value.trim().length ? value : "";
      const base = { ...current, text: finalText };
      const fitted = current.type === "sticky" ? fitStickyElement(base as StickyElement) : resizeTextElement(base as TextElement);
      s.setElementsLive(s.doc.elements.map((e) => (e.id === id ? fitted : e)));
      s.commit();
      s.select([id]);
      s.setTool("selection");
    }
    s.setEditingText(null);
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        liveUpdate(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          committedRef.current = true;
          useStore.getState().setEditingText(null);
        }
      }}
      onBlur={commit}
      style={{
        left: isSticky ? el.x * zoom + view.scrollX : cx,
        top: isSticky ? el.y * zoom + view.scrollY : cy,
        width: w,
        height: h,
        transform: isSticky
          ? `rotate(${angleDeg}deg)`
          : `translate(-50%, -50%) rotate(${angleDeg}deg)`,
        fontSize: el.fontSize * zoom,
        textAlign: el.textAlign,
        fontFamily: el.fontFamily,
        fontWeight: el.textBold ? 700 : 400,
        lineHeight: 1.25,
        color: isSticky ? el.strokeColor : undefined,
        ...(isSticky
          ? { padding: `${STICKY_PAD * zoom}px ${STICKY_PAD * zoom}px ${STICKY_PAD * zoom}px ${STICKY_PAD * zoom}px` }
          : {}),
      }}
    />
  );
}