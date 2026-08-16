import type { Element, ElementStyle, Point } from "../types";
import { makeArrow, makeRectangle, makeRoundedRectangle, makeText, makeEllipse, makeDiamond } from "../core/elements";
import { uid } from "../util/id";

export interface DiagramNode {
  id: string;
  label: string;
  type: "rectangle" | "roundedRectangle" | "ellipse" | "diamond" | "database";
  x: number;
  y: number;
  w: number;
  h: number;
  style: Partial<ElementStyle>;
  textStyle?: { fontSize?: number; textBold?: boolean; color?: string };
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  bidirectional?: boolean;
}

export interface DiagramSpec {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** optional container behind a set of node ids */
  containers?: Array<{
    label: string;
    nodeIds: string[];
    style?: Partial<ElementStyle>;
  }>;
}

const textPadding = 14;

export const estimateTextWidth = (label: string, fontSize: number): number => {
  const lines = label.split("\n");
  let max = 0;
  for (const line of lines) {
    max = Math.max(max, line.length * fontSize * 0.58);
  }
  return Math.max(24, max + textPadding * 2);
};

export const estimateTextHeight = (label: string, fontSize: number): number => {
  return Math.max(fontSize + 14, label.split("\n").length * fontSize * 1.25 + textPadding);
};

const makeNodeElement = (n: DiagramNode): Element => {
  const fs = n.textStyle?.fontSize ?? 15;
  const h = n.h || estimateTextHeight(n.label, fs);
  const w = n.w || estimateTextWidth(n.label, fs);
  const base = { ...n.style };
  let el: Element;
  switch (n.type) {
    case "ellipse":
      el = makeEllipse(n.x, n.y, w, h, base);
      break;
    case "diamond":
      el = makeDiamond(n.x, n.y, w, h, base);
      break;
    case "database":
      el = makeEllipse(n.x, n.y, w, h, { ...base, fillStyle: base.fillStyle ?? "solid" });
      break;
    case "rectangle":
      el = makeRectangle(n.x, n.y, w, h, base);
      break;
    default:
      el = makeRoundedRectangle(n.x, n.y, w, h, base);
  }
  el.id = n.id;
  return el;
};

const makeLabelElement = (n: DiagramNode): Element => {
  const fs = n.textStyle?.fontSize ?? 15;
  const w = n.w || estimateTextWidth(n.label, fs);
  const h = n.h || estimateTextHeight(n.label, fs);
  const cx = n.x + w / 2;
  const cy = n.y + h / 2;
  const t = makeText(0, 0, n.label, {
    ...n.style,
    strokeColor: n.textStyle?.color ?? n.style.strokeColor,
  }, fs);
  t.textBold = n.textStyle?.textBold ?? true;
  t.textAlign = "center";
  // measure & center
  const tc = document.createElement("canvas").getContext("2d");
  if (tc) {
    tc.font = `${t.textBold ? 700 : 400} ${fs}px ${t.fontFamily}`;
    const lines = n.label.split("\n");
    let mw = 0;
    for (const line of lines) mw = Math.max(mw, tc.measureText(line).width);
    t.width = mw;
    t.height = lines.length * fs * 1.25;
    t.x = cx - mw / 2;
    t.y = cy - t.height / 2;
  } else {
    t.width = w;
    t.height = h;
    t.x = n.x;
    t.y = n.y;
  }
  return t;
};

const edgeToElement = (
  edge: DiagramEdge,
  nodeMap: Map<string, DiagramNode>,
): Element => {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);
  if (!from || !to) return makeArrow(0, 0, { x: 0, y: 0 }, { x: 10, y: 10 });

  const fs = from.textStyle?.fontSize ?? 15;
  const fw = from.w || estimateTextWidth(from.label, fs);
  const fh = from.h || estimateTextHeight(from.label, fs);
  const tw = to.w || estimateTextWidth(to.label, fs);

  const fx = from.x + fw / 2;
  const fy = from.y + fh;
  const tx = to.x + tw / 2;
  const ty = to.y;

  const arrow = makeArrow(fx, fy, { x: 0, y: 0 }, { x: tx - fx, y: ty - fy }, {
    strokeColor: from.style.strokeColor ?? "#1e1e1e",
    strokeWidth: 2,
    roughness: 0.3,
    strokeStyle: "solid",
  });
  arrow.points = [
    { x: fx - from.x, y: fy - from.y },
    { x: tx - from.x, y: ty - from.y },
  ];
  // anchor the arrow element at its start so rotation/binding math is simple
  arrow.x = fx;
  arrow.y = fy;
  arrow.startBinding = { elementId: from.id, end: 0 };
  arrow.endBinding = { elementId: to.id, end: 1 };
  return arrow;
};

/**
 * Convert a DiagramSpec into a list of Elements, laid out at their given coordinates.
 */
export const specToElements = (spec: DiagramSpec): Element[] => {
  const nodeMap = new Map(spec.nodes.map((n) => [n.id, n]));

  const elements: Element[] = [];

  // containers first (behind nodes)
  for (const c of spec.containers ?? []) {
    const memberNodes = c.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean) as DiagramNode[];
    if (!memberNodes.length) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of memberNodes) {
      const w = n.w || estimateTextWidth(n.label, n.textStyle?.fontSize ?? 15);
      const h = n.h || estimateTextHeight(n.label, n.textStyle?.fontSize ?? 15);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    }
    const pad = 36;
    const box = makeRoundedRectangle(
      minX - pad,
      minY - pad - 14,
      maxX - minX + pad * 2,
      maxY - minY + pad * 2 + 14,
      {
        ...(c.style ?? {}),
        strokeColor: c.style?.strokeColor ?? "#8a8a86",
        strokeWidth: 1.6,
        roughness: 0.25,
        fillStyle: c.style?.fillStyle ?? "solid",
      },
    );
    box.id = uid();
    // group label
    const t = makeText(box.x + 24, box.y + 10, c.label, {
      strokeColor: c.style?.strokeColor ?? "#8a8a86",
      fillStyle: "solid",
    }, 13);
    t.textBold = false;
    t.width = c.label.length * 8;
    t.height = 18;
    elements.push(box, t);
  }

  for (const n of spec.nodes) {
    const el = makeNodeElement(n);
    elements.push(el);
    const label = makeLabelElement(n);
    elements.push(label);
  }

  for (const edge of spec.edges) {
    elements.push(edgeToElement(edge, nodeMap));
  }

  return elements;
};

export const nodeCenter = (n: DiagramNode): Point => {
  const fs = n.textStyle?.fontSize ?? 15;
  return {
    x: n.x + (n.w || estimateTextWidth(n.label, fs)) / 2,
    y: n.y + (n.h || estimateTextHeight(n.label, fs)) / 2,
  };
};