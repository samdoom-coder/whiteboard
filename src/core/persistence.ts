import type { Document, Element } from "../types";
import { docId } from "../util/id";
import { palettes } from "../util/color";

export const STORAGE_KEY = "whiteboard:doc";
const BACKUP_KEY = "whiteboard:doc:backup";

export interface StoredDocument extends Document {
  __v: number;
}

const migrate = (raw: unknown): Document | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.elements)) return null;

  const doc: Document = {
    id: typeof r.id === "string" ? r.id : docId(),
    name: typeof r.name === "string" ? r.name : "Untitled whiteboard",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
    version: typeof r.version === "number" ? r.version : 1,
    scene: {
      name: typeof r.name === "string" ? r.name : "Untitled whiteboard",
      background: "dots",
      backgroundColor: palettes.light.canvasBackground,
      view: { scrollX: 0, scrollY: 0, zoom: 1 },
      version: 1,
      ...(typeof r.scene === "object" && r.scene
        ? (r.scene as Record<string, unknown>)
        : {}),
    },
    elements: (r.elements as Element[]).filter(isValidElement),
  };
  return doc;
};

const isValidElement = (e: unknown): e is Element => {
  if (!e || typeof e !== "object") return false;
  const el = e as Record<string, unknown>;
  return (
    typeof el.id === "string" &&
    typeof el.type === "string" &&
    typeof el.x === "number" &&
    typeof el.y === "number"
  );
};

export const persistDocument = (doc: Document): boolean => {
  try {
    const stored: StoredDocument = { ...doc, __v: 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch (e) {
    console.warn("Failed to persist document", e);
    return false;
  }
};

export const loadDocument = (): Document | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) return migrate(JSON.parse(backup));
    } catch {
      /* ignore */
    }
    return null;
  }
};

export const clearDocument = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};