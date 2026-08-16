import type {
  Element,
  ElementStyle,
  ImageElement,
  LineElement,
  PencilElement,
  Point,
  TextElement,
} from "../types";
import { uid } from "../util/id";

export const defaultStyle = (): ElementStyle => ({
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  opacity: 1,
  roughness: 0.2,
  roundness: 0.5,
});

export const baseElement = (
  type: Element["type"],
  x: number,
  y: number,
  style: Partial<ElementStyle> = {},
  width = 0,
  height = 0,
) => ({
  id: uid(),
  type,
  x,
  y,
  width,
  height,
  angle: 0,
  seed: Math.floor(Math.random() * 2 ** 31),
  ...defaultStyle(),
  ...style,
});

export const makeRectangle = (
  x: number,
  y: number,
  w: number,
  h: number,
  style: Partial<ElementStyle> = {},
): Element => baseElement("rectangle", x, y, style, w, h) as Element;

export const makeRoundedRectangle = (
  x: number,
  y: number,
  w: number,
  h: number,
  style: Partial<ElementStyle> = {},
): Element =>
  baseElement("roundedRectangle", x, y, style, w, h) as Element;

export const makeEllipse = (
  x: number,
  y: number,
  w: number,
  h: number,
  style: Partial<ElementStyle> = {},
): Element => baseElement("ellipse", x, y, style, w, h) as Element;

export const makeDiamond = (
  x: number,
  y: number,
  w: number,
  h: number,
  style: Partial<ElementStyle> = {},
): Element => baseElement("diamond", x, y, style, w, h) as Element;

export const makeLine = (
  x: number,
  y: number,
  a: Point,
  b: Point,
  style: Partial<ElementStyle> = {},
): LineElement => {
  const el = baseElement("line", x, y, style) as LineElement;
  el.points = [a, b];
  return el;
};

export const makeArrow = (
  x: number,
  y: number,
  a: Point,
  b: Point,
  style: Partial<ElementStyle> = {},
): LineElement => {
  const el = baseElement("arrow", x, y, style) as LineElement;
  el.points = [a, b];
  return el;
};

export const makePencil = (
  x: number,
  y: number,
  points: Point[],
  style: Partial<ElementStyle> = {},
): PencilElement => {
  const el = baseElement("pencil", x, y, style) as PencilElement;
  el.points = points;
  el.width = 0;
  el.height = 0;
  return el;
};

export const makeText = (
  x: number,
  y: number,
  text: string,
  style: Partial<ElementStyle> = {},
  fontSize = 20,
): TextElement => {
  const el = baseElement("text", x, y, style) as TextElement;
  el.text = text;
  el.fontSize = fontSize;
  el.fontFamily = "Inter, system-ui, sans-serif";
  el.textAlign = "left";
  el.textBold = false;
  const m = measureText(text, fontSize, el.fontFamily, false);
  el.width = m.width;
  el.height = m.height;
  return el;
};

/** Measure text dimensions at creation time so text elements are selectable immediately. */
export const measureText = (
  text: string,
  fontSize: number,
  fontFamily: string,
  bold: boolean,
): { width: number; height: number } => {
  const font = `${bold ? "700" : "400"} ${fontSize}px ${fontFamily}`;
  const lines = text.split("\n");
  let max = 0;
  try {
    const c = document.createElement("canvas").getContext("2d");
    if (c) {
      c.font = font;
      for (const line of lines) max = Math.max(max, c.measureText(line).width);
    }
  } catch {
    /* no DOM available */
  }
  if (!max) max = lines.reduce((m, l) => Math.max(m, l.length * fontSize * 0.6), 0);
  return { width: Math.max(max, fontSize * 0.8), height: lines.length * fontSize * 1.25 };
};

export const makeImage = (
  x: number,
  y: number,
  dataURL: string,
  naturalWidth: number,
  naturalHeight: number,
  style: Partial<ElementStyle> = {},
): ImageElement => {
  const el = baseElement("image", x, y, style) as ImageElement;
  el.dataURL = dataURL;
  el.naturalWidth = naturalWidth;
  el.naturalHeight = naturalHeight;
  const maxW = 360;
  const scale = Math.min(1, maxW / naturalWidth);
  el.width = naturalWidth * scale;
  el.height = naturalHeight * scale;
  return el;
};

/** clone an element with a fresh id (used by AI/templates to re-place same-shape defs) */
export const cloneElement = (el: Element): Element => ({ ...el, id: uid(), seed: Math.floor(Math.random() * 2 ** 31) });