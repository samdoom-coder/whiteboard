import type { Element, Point } from "../types";
import { rotatePoint } from "../util/math";
import { elementBounds, rotatedCorners, worldToLocal } from "./geometry";

export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate";

export const ALL_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export const oppositeHandle: Record<
  Exclude<ResizeHandle, "rotate">,
  Exclude<ResizeHandle, "rotate">
> = {
  nw: "se",
  n: "s",
  ne: "sw",
  e: "w",
  se: "nw",
  s: "n",
  sw: "ne",
  w: "e",
};

const MIN_SIZE = 4;

/**
 * Resize a single element by dragging a handle. Works in the element's local
 * (rotated) coordinate space so rotated elements resize intuitively.
 */
export const resizeElement = (
  el: Element,
  handle: Exclude<ResizeHandle, "rotate">,
  pointerWorld: Point,
  shift: boolean,
): Element => {
  if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
    return el;
  }

  const local = worldToLocal(el, pointerWorld);
  const anchorHandle = oppositeHandle[handle];
  const anchorPos = handleCornerLocal(el, anchorHandle);

  const movesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const movesRight = handle === "ne" || handle === "e" || handle === "se";
  const movesTop = handle === "nw" || handle === "n" || handle === "ne";
  const movesBottom = handle === "sw" || handle === "s" || handle === "se";

  const anchorX = anchorPos.x;
  const anchorY = anchorPos.y;

  let nx = el.x;
  let ny = el.y;
  let nw = el.width;
  let nh = el.height;

  if (movesLeft) {
    const right = anchorX + el.width;
    nw = right - local.x;
    nx = local.x;
  } else if (movesRight) {
    nw = local.x - anchorX;
    nx = anchorX;
  }

  if (movesTop) {
    const bottom = anchorY + el.height;
    nh = bottom - local.y;
    ny = local.y;
  } else if (movesBottom) {
    nh = local.y - anchorY;
    ny = anchorY;
  }

  nw = Math.max(MIN_SIZE, nw);
  nh = Math.max(MIN_SIZE, nh);

  // constrain aspect ratio
  if (shift) {
    const ratio = el.width / Math.max(1, el.height);
    const movingX = movesLeft || movesRight;
    const movingY = movesTop || movesBottom;
    if (movingX && movingY) {
      const s = Math.max(nw / el.width, nh / el.height);
      nw = el.width * s;
      nh = el.height * s;
      if (movesLeft) nx = anchorX + el.width - nw;
      if (movesTop) ny = anchorY + el.height - nh;
    } else if (movingX) {
      nh = nw / ratio;
      if (movesTop) ny = anchorY + el.height - nh;
    } else {
      nw = nh * ratio;
      if (movesLeft) nx = anchorX + el.width - nw;
    }
  }

  return { ...el, x: nx, y: ny, width: nw, height: nh };
};

const handleCornerLocal = (
  el: Element,
  h: Exclude<ResizeHandle, "rotate">,
): Point => {
  const w = el.width;
  const hh = el.height;
  switch (h) {
    case "nw":
      return { x: el.x, y: el.y };
    case "n":
      return { x: el.x + w / 2, y: el.y };
    case "ne":
      return { x: el.x + w, y: el.y };
    case "e":
      return { x: el.x + w, y: el.y + hh / 2 };
    case "se":
      return { x: el.x + w, y: el.y + hh };
    case "s":
      return { x: el.x + w / 2, y: el.y + hh };
    case "sw":
      return { x: el.x, y: el.y + hh };
    case "w":
      return { x: el.x, y: el.y + hh / 2 };
  }
};

/**
 * Compute the selection box (world space) for a group of elements.
 * For a single element, use its rotated corners; for multi, axis-aligned union.
 */
export const selectionBox = (
  elements: Element[],
): { points: Point[]; angle: number; center: Point } => {
  if (elements.length === 1) {
    const el = elements[0];
    const pts = rotatedCorners(el);
    const center = {
      x: (pts[0].x + pts[2].x) / 2,
      y: (pts[0].y + pts[2].y) / 2,
    };
    return { points: pts, angle: el.angle, center };
  }
  const b = elementBounds(elements[0]);
  for (const el of elements) {
    const eb = elementBounds(el);
    b.minX = Math.min(b.minX, eb.minX);
    b.minY = Math.min(b.minY, eb.minY);
    b.maxX = Math.max(b.maxX, eb.maxX);
    b.maxY = Math.max(b.maxY, eb.maxY);
  }
  const points = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  return {
    points,
    angle: 0,
    center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
  };
};

/** handle positions in world space for a selection box */
export const handlePositions = (
  box: { points: Point[]; angle: number },
): Record<Exclude<ResizeHandle, "rotate">, Point> => {
  const [nw, ne, se, sw] = box.points;
  const n = {
    x: (nw.x + ne.x) / 2,
    y: (nw.y + ne.y) / 2,
  };
  const e = {
    x: (ne.x + se.x) / 2,
    y: (ne.y + se.y) / 2,
  };
  const s = {
    x: (sw.x + se.x) / 2,
    y: (sw.y + se.y) / 2,
  };
  const w = {
    x: (nw.x + sw.x) / 2,
    y: (nw.y + sw.y) / 2,
  };
  return { nw, n, ne, e, se, s, sw, w };
};

/** rotate handle position: above the north edge */
export const rotateHandlePos = (
  box: { points: Point[]; angle: number },
  offset = 26,
): Point => {
  const [nw, ne] = box.points;
  const mid = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 };
  const a = box.angle + Math.PI / 2;
  return { x: mid.x + Math.cos(a) * offset, y: mid.y + Math.sin(a) * offset };
};

/** Resize a group of elements (uniform bounds scaling). */
export const resizeGroup = (
  elements: Element[],
  handle: Exclude<ResizeHandle, "rotate">,
  pointerWorld: Point,
  shift: boolean,
  origin: { x: number; y: number },
): Element[] => {
  // The "origin" is the anchor point (opposite of dragged handle), world space.
  const anchor = origin;
  let sx = 1;
  let sy = 1;

  const b = elementBounds(elements[0]);
  for (const el of elements) {
    const eb = elementBounds(el);
    b.minX = Math.min(b.minX, eb.minX);
    b.minY = Math.min(b.minY, eb.minY);
    b.maxX = Math.max(b.maxX, eb.maxX);
    b.maxY = Math.max(b.maxY, eb.maxY);
  }
  const bW = b.maxX - b.minX || 1;
  const bH = b.maxY - b.minY || 1;
  const dx = pointerWorld.x - anchor.x;
  const dy = pointerWorld.y - anchor.y;

  const movesRight = handle === "e" || handle === "ne" || handle === "se";
  const movesBottom = handle === "s" || handle === "se" || handle === "sw";
  const movesLeft = handle === "w" || handle === "nw" || handle === "sw";
  const movesTop = handle === "n" || handle === "nw" || handle === "ne";

  const rightEdge = b.maxX;
  const bottomEdge = b.maxY;

  sx = movesRight ? (rightEdge - anchor.x + dx) / (rightEdge - anchor.x) : movesLeft ? (b.minX - anchor.x + dx) / (b.minX - anchor.x) : 1;
  sy = movesBottom ? (bottomEdge - anchor.y + dy) / (bottomEdge - anchor.y) : movesTop ? (b.minY - anchor.y + dy) / (b.minY - anchor.y) : 1;

  sx = Math.max(0.05, sx);
  sy = Math.max(0.05, sy);
  if (shift) {
    const s = Math.max(sx, sy);
    sx = s;
    sy = s;
  }
  void bW;
  void bH;

  return elements.map((el) => {
    if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
      const nx = anchor.x + (el.x - anchor.x) * sx;
      const ny = anchor.y + (el.y - anchor.y) * sy;
      const pts = el.points.map((p) => ({
        x: p.x * sx,
        y: p.y * sy,
      }));
      return { ...el, x: nx, y: ny, points: pts };
    }
    const ex = anchor.x + (el.x - anchor.x) * sx;
    const ey = anchor.y + (el.y - anchor.y) * sy;
    return {
      ...el,
      x: ex,
      y: ey,
      width: Math.max(MIN_SIZE, el.width * sx),
      height: Math.max(MIN_SIZE, el.height * sy),
    };
  });
};

export const clampAngle = (a: number, snapTo: number | null) => {
  if (snapTo != null) {
    const snapped = Math.round(a / snapTo) * snapTo;
    return snapped;
  }
  return a;
};

export const rotateElements = (
  elements: Element[],
  angle: number,
  center: Point,
): Element[] =>
  elements.map((el) => {
    if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
      const p = rotatePoint(el.x, el.y, center.x, center.y, angle);
      return { ...el, x: p.x, y: p.y, angle: el.angle + angle };
    }
    return { ...el, angle: el.angle + angle };
  });