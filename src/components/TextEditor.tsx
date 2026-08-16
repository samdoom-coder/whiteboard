import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import type { TextElement } from "../types";
import { resizeTextElement } from "../render/renderer";

export function TextEditor({ id }: { id: string }) {
  const el = useStore((s) => s.doc.elements.find((e) => e.id === id) as TextElement | undefined);
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

  const zoom = view.zoom;
  const cx = (el.x + el.width / 2) * zoom + view.scrollX;
  const cy = (el.y + el.height / 2) * zoom + view.scrollY;
  const w = Math.max(60, el.width * zoom);
  const h = Math.max(30, el.height * zoom);
  const angleDeg = (el.angle * 180) / Math.PI;

  const liveUpdate = (text: string) => {
    const s = useStore.getState();
    const current = s.doc.elements.find((e) => e.id === id) as TextElement | undefined;
    if (!current) return;
    const base = { ...current, text };
    const fitted = resizeTextElement(base);
    s.setElementsLive(s.doc.elements.map((e) => (e.id === id ? fitted : e)));
  };

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const s = useStore.getState();
    const current = s.doc.elements.find((e) => e.id === id) as TextElement | undefined;
    if (current) {
      const finalText = value.trim().length ? value : "";
      const fitted = resizeTextElement({ ...current, text: finalText });
      s.setElementsLive(s.doc.elements.map((e) => (e.id === id ? fitted : e)));
      s.commit();
      s.select([id]);
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
        left: cx,
        top: cy,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
        fontSize: el.fontSize * zoom,
        textAlign: el.textAlign,
        fontFamily: el.fontFamily,
        fontWeight: el.textBold ? 700 : 400,
        lineHeight: 1.25,
      }}
    />
  );
}