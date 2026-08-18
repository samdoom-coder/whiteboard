import { create } from "zustand";
import type {
  Document,
  Element,
  ElementStyle,
  Theme,
  ToolType,
} from "../types";
import { docId, uid } from "../util/id";
import { sync } from "./sync";
import { persistDocument, loadDocument, STORAGE_KEY, loadStyle, saveStyle } from "./persistence";
import { palettes, isDarkColor } from "../util/color";

export interface WhiteboardState {
  doc: Document;
  theme: Theme;
  tool: ToolType;
  selectedIds: string[];
  editingTextId: string | null;
  hoveredId: string | null;
  /** true while a transient preview element exists on the canvas */
  previewing: boolean;

  saveStatus: "idle" | "dirty" | "saving" | "saved" | "error";

  /** true while a topbar menu (templates/settings) is open */
  popoverOpen: boolean;
  setPopoverOpen: (v: boolean) => void;

  /** shared style applied to newly created elements */
  activeStyle: ElementStyle;
  setActiveStyle: (patch: Partial<ElementStyle>) => void;

  // history
  historyPast: Element[][];
  historyFuture: Element[][];

  // ---- view / scene ----
  setScene: (patch: Partial<Document["scene"]>) => void;
  setView: (patch: { scrollX?: number; scrollY?: number; zoom?: number }) => void;
  setTheme: (t: Theme) => void;

  // ---- selection / app state ----
  setTool: (t: ToolType) => void;
  select: (ids: string[], additive?: boolean) => void;
  setHovered: (id: string | null) => void;
  setEditingText: (id: string | null) => void;
  setPreviewing: (v: boolean) => void;

  // ---- element mutations ----
  setElementsLive: (els: Element[]) => void;
  replaceElements: (els: Element[]) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  addElement: (el: Element) => void;
  addElements: (els: Element[], opts?: { commit?: boolean; select?: boolean }) => void;
  deleteSelected: () => void;
  deleteElements: (ids: string[]) => void;
  duplicateSelected: (offset?: number) => void;
  copySelected: () => void;
  pasteClipboard: (at?: { x: number; y: number }) => void;
  selectAll: () => void;
  clearCanvas: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  setCanvasName: (name: string) => void;
  resetFromDocument: (doc: Document) => void;
  markSaved: () => void;
  /** push a history snapshot without changing elements (used at gesture start) */
  beginGesture: () => void;
  /** save without snapshot */
  save: () => void;
}

const makeScene = (): Document["scene"] => ({
  name: "Untitled whiteboard",
  background: "dots",
  backgroundColor: palettes.light.canvasBackground,
  view: { scrollX: 0, scrollY: 0, zoom: 1 },
  version: 1,
});

const makeDoc = (): Document => ({
  id: docId(),
  name: "Untitled whiteboard",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  scene: makeScene(),
  elements: [],
  version: 1,
});

const MAX_HISTORY = 120;

const DEFAULT_ACTIVE_STYLE: ElementStyle = {
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  opacity: 1,
  roughness: 0.2,
  roundness: 0.5,
};

const DEFAULT_STROKE_LIGHT = "#1e1e1e";
const DEFAULT_STROKE_DARK = "#ffffff";
/** the default stroke is only auto-adapted while the user hasn't picked a custom color */
const isDefaultStroke = (c: string) => c === DEFAULT_STROKE_LIGHT || c === DEFAULT_STROKE_DARK;
const strokeForBackground = (bg: string) => (isDarkColor(bg) ? DEFAULT_STROKE_DARK : DEFAULT_STROKE_LIGHT);

const boundsOf = (els: Element[]) => {
  if (!els.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<WhiteboardState>()((set, get) => {
  const init = loadDocument() ?? makeDoc();
  const activeStyle = loadStyle(DEFAULT_ACTIVE_STYLE);

  const save = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const s = useStore.getState();
      const ok = persistDocument(s.doc);
      useStore.setState({ saveStatus: ok ? "saved" : "error" });
    }, 350);
  };

  const withHistory = (next: Element[], extra: Partial<WhiteboardState> = {}) => {
    const s = get();
    set({
      doc: { ...s.doc, elements: next, updatedAt: Date.now() },
      historyPast: [...s.historyPast.slice(-(MAX_HISTORY - 1)), s.doc.elements],
      historyFuture: [],
      selectedIds: s.selectedIds.filter((id) => next.some((e) => e.id === id)),
      saveStatus: "dirty",
      ...extra,
    });
    save();
    sync.publish(get().doc);
  };

  return {
    doc: init,
    theme: (localStorage.getItem(`${STORAGE_KEY}:theme`) as Theme) || "light",
    tool: "selection",
    selectedIds: [],
    editingTextId: null,
    hoveredId: null,
    previewing: false,
    saveStatus: "saved",
    historyPast: [],
    historyFuture: [],
    popoverOpen: false,
    setPopoverOpen: (v) => set({ popoverOpen: v }),

    activeStyle,
    setActiveStyle: (patch) => {
      set((s) => {
        const next = { ...s.activeStyle, ...patch };
        saveStyle(next);
        return { activeStyle: next };
      });
    },

    setScene: (patch) => {
      set((s) => {
        const next: { doc: Document; saveStatus: "dirty"; activeStyle?: ElementStyle } = {
          doc: {
            ...s.doc,
            scene: { ...s.doc.scene, ...patch },
            updatedAt: Date.now(),
          },
          saveStatus: "dirty",
        };
        if (
          patch.backgroundColor &&
          patch.backgroundColor !== s.doc.scene.backgroundColor &&
          isDefaultStroke(s.activeStyle.strokeColor)
        ) {
          const strokeColor = strokeForBackground(patch.backgroundColor);
          if (strokeColor !== s.activeStyle.strokeColor) {
            next.activeStyle = { ...s.activeStyle, strokeColor };
            saveStyle(next.activeStyle);
          }
        }
        return next;
      });
      save();
      sync.publish(get().doc);
    },

    setView: (patch) => {
      set((s) => ({
        doc: {
          ...s.doc,
          scene: { ...s.doc.scene, view: { ...s.doc.scene.view, ...patch } },
        },
      }));
    },

    setTheme: (t) => {
      set((s) => {
        const next: { theme: Theme; activeStyle?: ElementStyle } = { theme: t };
        if (isDefaultStroke(s.activeStyle.strokeColor)) {
          const strokeColor = strokeForBackground(s.doc.scene.backgroundColor);
          if (strokeColor !== s.activeStyle.strokeColor) {
            next.activeStyle = { ...s.activeStyle, strokeColor };
            saveStyle(next.activeStyle);
          }
        }
        return next;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}:theme`, t);
      } catch {
        /* ignore */
      }
    },

    setTool: (t) => {
      const s = get();
      const selectedIds =
        t === "selection" || t === "hand" ? s.selectedIds : [];
      set({ tool: t, selectedIds });
    },

    select: (ids, additive) => {
      if (additive) {
        const next = new Set(get().selectedIds);
        ids.forEach((id) => {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        });
        set({ selectedIds: [...next] });
      } else {
        set({ selectedIds: ids });
      }
    },

    setHovered: (id) => set({ hoveredId: id }),
    setEditingText: (id) => set({ editingTextId: id }),
    setPreviewing: (v) => set({ previewing: v }),

    setElementsLive: (els) => {
      set((s) => ({ doc: { ...s.doc, elements: els }, saveStatus: "dirty" }));
    },

    replaceElements: (els) => withHistory(els),

    commit: () => {
      const s = get();
      if (s.doc.elements === s.historyPast[s.historyPast.length - 1]) return;
      set({
        historyPast: [...s.historyPast.slice(-(MAX_HISTORY - 1)), s.doc.elements],
        historyFuture: [],
        saveStatus: "dirty",
      });
      save();
      sync.publish(get().doc);
    },

    beginGesture: () => {
      const s = get();
      if (s.doc.elements === s.historyPast[s.historyPast.length - 1]) return;
      set({
        historyPast: [...s.historyPast.slice(-(MAX_HISTORY - 1)), s.doc.elements],
        historyFuture: [],
      });
    },

    undo: () => {
      const s = get();
      if (!s.historyPast.length) return;
      const prev = s.historyPast[s.historyPast.length - 1];
      set({
        doc: { ...s.doc, elements: prev, updatedAt: Date.now() },
        historyPast: s.historyPast.slice(0, -1),
        historyFuture: [s.doc.elements, ...s.historyFuture].slice(0, MAX_HISTORY),
        selectedIds: s.selectedIds.filter((id) => prev.some((e) => e.id === id)),
        editingTextId: null,
        saveStatus: "dirty",
      });
      save();
      sync.publish(get().doc);
    },

    redo: () => {
      const s = get();
      if (!s.historyFuture.length) return;
      const next = s.historyFuture[0];
      set({
        doc: { ...s.doc, elements: next, updatedAt: Date.now() },
        historyFuture: s.historyFuture.slice(1),
        historyPast: [...s.historyPast, s.doc.elements].slice(-MAX_HISTORY),
        selectedIds: s.selectedIds.filter((id) => next.some((e) => e.id === id)),
        editingTextId: null,
        saveStatus: "dirty",
      });
      save();
      sync.publish(get().doc);
    },

    addElement: (el) => {
      get().addElements([el]);
    },

    addElements: (els, opts) => {
      const s = get();
      const next = [...s.doc.elements, ...els];
      const doCommit = opts?.commit !== false;
      set({
        doc: { ...s.doc, elements: next, updatedAt: Date.now() },
        selectedIds: opts?.select === false ? s.selectedIds : els.map((e) => e.id),
        saveStatus: "dirty",
      });
      if (doCommit) {
        set((st) => ({
          historyPast: [...st.historyPast.slice(-(MAX_HISTORY - 1)), s.doc.elements],
          historyFuture: [],
        }));
      }
      save();
      sync.publish(get().doc);
    },

    deleteSelected: () => get().deleteElements(get().selectedIds),

    deleteElements: (ids) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      const next = get()
        .doc.elements.filter((e) => !idSet.has(e.id))
        .map((e) => {
          if (e.type === "line" || e.type === "arrow") {
            let el = e;
            if (el.startBinding && idSet.has(el.startBinding.elementId)) el = { ...el, startBinding: null };
            if (el.endBinding && idSet.has(el.endBinding.elementId)) el = { ...el, endBinding: null };
            return el;
          }
          return e;
        });
      withHistory(next, { selectedIds: [] });
    },

    duplicateSelected: (offset = 16) => {
      const s = get();
      if (!s.selectedIds.length) return;
      const idMap = new Map<string, string>();
      const clones = s.doc.elements
        .filter((e) => s.selectedIds.includes(e.id))
        .map((e) => {
          const nid = uid();
          idMap.set(e.id, nid);
          return { ...e, id: nid, x: e.x + offset, y: e.y + offset };
        })
        .map((e) => {
          if ((e.type === "line" || e.type === "arrow") && e.startBinding) {
            const t = idMap.get(e.startBinding.elementId);
            if (t) return { ...e, startBinding: { ...e.startBinding, elementId: t } };
          }
          if ((e.type === "line" || e.type === "arrow") && e.endBinding) {
            const t = idMap.get(e.endBinding.elementId);
            if (t) return { ...e, endBinding: { ...e.endBinding, elementId: t } };
          }
          return e;
        });
      withHistory([...s.doc.elements, ...clones], { selectedIds: clones.map((c) => c.id) });
    },

    copySelected: () => {
      const s = get();
      const sel = s.doc.elements.filter((e) => s.selectedIds.includes(e.id));
      if (!sel.length) return;
      try {
        localStorage.setItem("whiteboard:clipboard", JSON.stringify(sel));
      } catch {
        /* ignore */
      }
    },

    pasteClipboard: (at) => {
      const s = get();
      try {
        const raw = localStorage.getItem("whiteboard:clipboard");
        if (!raw) return;
        const elements = JSON.parse(raw) as Element[];
        const b = boundsOf(elements);
        const idMap = new Map<string, string>();
        const clones = elements.map((e) => {
          const nid = uid();
          idMap.set(e.id, nid);
          return { ...e, id: nid };
        });
        const ox = at ? at.x - (b.minX + b.maxX) / 2 : 24;
        const oy = at ? at.y - (b.minY + b.maxY) / 2 : 24;
        const placed = clones
          .map((e) => ({ ...e, x: e.x + ox, y: e.y + oy }))
          .map((e) => {
            if ((e.type === "line" || e.type === "arrow") && e.startBinding) {
              const t = idMap.get(e.startBinding.elementId);
              if (t) return { ...e, startBinding: { ...e.startBinding, elementId: t } };
            }
            if ((e.type === "line" || e.type === "arrow") && e.endBinding) {
              const t = idMap.get(e.endBinding.elementId);
              if (t) return { ...e, endBinding: { ...e.endBinding, elementId: t } };
            }
            return e;
          });
        withHistory([...s.doc.elements, ...placed], { selectedIds: placed.map((p) => p.id) });
      } catch {
        /* ignore */
      }
    },

    selectAll: () => set({ selectedIds: get().doc.elements.map((e) => e.id) }),

    clearCanvas: () => {
      withHistory([], { selectedIds: [], editingTextId: null });
    },

    bringToFront: () => reorder(get, "front"),
    sendToBack: () => reorder(get, "back"),
    bringForward: () => reorder(get, "forward"),
    sendBackward: () => reorder(get, "backward"),

    setCanvasName: (name) => {
      set((s) => ({ doc: { ...s.doc, scene: { ...s.doc.scene, name } }, saveStatus: "dirty" }));
      save();
      sync.publish(get().doc);
    },

    resetFromDocument: (doc) => {
      set({
        doc,
        historyPast: [],
        historyFuture: [],
        selectedIds: [],
        editingTextId: null,
        saveStatus: "saved",
      });
      save();
    },

    markSaved: () => set({ saveStatus: "saved" }),
    save: () => save(),
  };
});

const reorder = (
  get: () => WhiteboardState,
  kind: "front" | "back" | "forward" | "backward",
) => {
  const s = get();
  const sel = new Set(s.selectedIds);
  if (!sel.size) return;
  const others = s.doc.elements.filter((e) => !sel.has(e.id));
  const selected = s.doc.elements.filter((e) => sel.has(e.id));
  let next: Element[];
  if (kind === "front") next = [...others, ...selected];
  else if (kind === "back") next = [...selected, ...others];
  else if (kind === "forward") {
    next = s.doc.elements.slice();
    for (let i = next.length - 2; i >= 0; i--) {
      if (sel.has(next[i].id) && !sel.has(next[i + 1].id)) {
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
  } else {
    next = s.doc.elements.slice();
    for (let i = 1; i < next.length; i++) {
      if (sel.has(next[i].id) && !sel.has(next[i - 1].id)) {
        [next[i], next[i - 1]] = [next[i - 1], next[i]];
      }
    }
  }
  s.replaceElements(next);
};

export const getStore = () => useStore.getState();