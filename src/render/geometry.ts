import type { Element, LineElement, Point, ShapeElement } from "../types";
import {
  dist,
  distToSegment,
  pointInRotatedRect,
  rotatePoint,
} from "../util/math";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const elementBounds = (el: Element): Bounds => {
  if (el.type === "line" || el.type === "arrow") {
    const pts = (el as LineElement).points;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      const gx = el.x + p.x;
      const gy = el.y + p.y;
      if (gx < minX) minX = gx;
      if (gy < minY) minY = gy;
      if (gx > maxX) maxX = gx;
      if (gy > maxY) maxY = gy;
    }
    // pad for arrowheads / stroke width
    const pad = 12 + el.strokeWidth;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }
  if (el.type === "pencil") {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      const gx = el.x + p.x;
      const gy = el.y + p.y;
      if (gx < minX) minX = gx;
      if (gy < minY) minY = gy;
      if (gx > maxX) maxX = gx;
      if (gy > maxY) maxY = gy;
    }
    const pad = el.strokeWidth;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + el.width,
    maxY: el.y + el.height,
  };
};

export const boundsFromElements = (els: Element[]): Bounds | null => {
  if (!els.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    const b = elementBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
};

export const boundsCenter = (b: Bounds) => ({
  x: (b.minX + b.maxX) / 2,
  y: (b.minY + b.maxY) / 2,
});

/** Expand bounds by a margin. */
export const expandBounds = (b: Bounds, m: number): Bounds => ({
  minX: b.minX - m,
  minY: b.minY - m,
  maxX: b.maxX + m,
  maxY: b.maxY + m,
});

export const boundsOverlap = (a: Bounds, b: Bounds) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Convert local (relative to element origin, pre-rotation) point to world point. */
export const localToWorld = (el: Element, p: Point): Point => {
  if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
    // points are stored relative to el.x/el.y, so rotate around the origin then translate
    const rp = rotatePoint(p.x, p.y, 0, 0, el.angle);
    return { x: el.x + rp.x, y: el.y + rp.y };
  }
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return rotatePoint(p.x, p.y, cx, cy, el.angle);
};

export const worldToLocal = (el: Element, p: Point): Point => {
  if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
    return rotatePoint(p.x - el.x, p.y - el.y, 0, 0, -el.angle);
  }
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return rotatePoint(p.x, p.y, cx, cy, -el.angle);
};

/** Local-space geometry of a shape element (relative to origin, centered). */
export const shapeLocalGeometry = (el: ShapeElement) => {
  const w = el.width;
  const h = el.height;
  const hw = w / 2;
  const hh = h / 2;
  const cx = el.x + hw;
  const cy = el.y + hh;
  switch (el.type) {
    case "rectangle":
    case "roundedRectangle":
    case "text":
    case "image":
      return {
        cx,
        cy,
        kind: "rect" as const,
        corners: [
          { x: el.x, y: el.y },
          { x: el.x + w, y: el.y },
          { x: el.x + w, y: el.y + h },
          { x: el.x, y: el.y + h },
        ],
      };
    case "ellipse": {
      // sample the ellipse in local space
      const pts: Point[] = [];
      const steps = 48;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * hw, y: cy + Math.sin(a) * hh });
      }
      return { cx, cy, kind: "ellipse" as const, corners: pts };
    }
    case "diamond": {
      const corners = [
        { x: cx, y: el.y },
        { x: el.x + w, y: cy },
        { x: cx, y: el.y + h },
        { x: el.x, y: cy },
      ];
      return { cx, cy, kind: "diamond" as const, corners };
    }
  }
};

/** Test hit between a point (world) and element. tolerance in world units. */
export const hitTestElement = (el: Element, p: Point, tolerance = 0): boolean => {
  const worldP = p;
  if (el.isDeleted) return false;

  if (el.type === "line" || el.type === "arrow") {
    const pts = (el as LineElement).points.map((q) => localToWorld(el, q));
    const tol = Math.max(tolerance, el.strokeWidth + 6);
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(worldP.x, worldP.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tol) {
        return true;
      }
    }
    // check arrowhead near last point
    if (el.type === "arrow") {
      const last = pts[pts.length - 1];
      if (dist(worldP.x, worldP.y, last.x, last.y) <= tol + 10) return true;
    }
    return false;
  }

  if (el.type === "pencil") {
    const pts = el.points.map((q) => localToWorld(el, q));
    const tol = Math.max(tolerance, el.strokeWidth + 6);
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(worldP.x, worldP.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tol) {
        return true;
      }
    }
    return false;
  }

  const b = elementBounds(el);
  if (tolerance > 0) {
    // allow tolerance around bounds for shapes too
    if (
      worldP.x < b.minX - tolerance ||
      worldP.x > b.maxX + tolerance ||
      worldP.y < b.minY - tolerance ||
      worldP.y > b.maxY + tolerance
    ) {
      return false;
    }
  }
  const geom = shapeLocalGeometry(el as ShapeElement);
  if (geom.kind === "rect") {
    const cx = geom.cx;
    const cy = geom.cy;
    return pointInRotatedRect(worldP.x, worldP.y, cx, cy, el.width, el.height, el.angle);
  }
  if (geom.kind === "ellipse") {
    const local = worldToLocal(el, worldP);
    const nx = (local.x - geom.cx) / (el.width / 2);
    const ny = (local.y - geom.cy) / (el.height / 2);
    return nx * nx + ny * ny <= 1;
  }
  if (geom.kind === "diamond") {
    const local = worldToLocal(el, worldP);
    const hw = el.width / 2;
    const hh = el.height / 2;
    const dx = Math.abs(local.x - geom.cx) / hw;
    const dy = Math.abs(local.y - geom.cy) / hh;
    return dx + dy <= 1;
  }
  return false;
};

/** Find element at a world point (topmost first). */
export const hitTestElements = (els: Element[], p: Point): Element | null => {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (hitTestElement(el, p)) return el;
  }
  return null;
};

/** Elements fully or partially inside a marquee rect (world coords). */
export const elementsInRect = (els: Element[], rect: { x: number; y: number; w: number; h: number }): Element[] => {
  const out: Element[] = [];
  for (const el of els) {
    const b = elementBounds(el);
    if (boundsOverlap(b, { minX: rect.x, minY: rect.y, maxX: rect.x + rect.w, maxY: rect.y + rect.h })) {
      out.push(el);
    }
  }
  return out;
};

/** Distance from a point to a shape's outline (world space, unrotated bounds). */
export const distanceToShape = (el: Element, p: Point): number => {
  const local = worldToLocal(el, p);
  const geom = shapeLocalGeometry(el as ShapeElement);
  const cx = geom.cx;
  const cy = geom.cy;
  if (geom.kind === "ellipse") {
    const hw = el.width / 2;
    const hh = el.height / 2;
    const a = Math.atan2(local.y - cy, local.x - cx);
    const rx = Math.hypot(hw * Math.cos(a), hh * Math.sin(a));
    const edge = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * rx };
    const edgeWorld = localToWorld(el, edge);
    return dist(p.x, p.y, edgeWorld.x, edgeWorld.y);
  }
  if (geom.kind === "diamond") {
    const corners = geom.corners.map((c) => localToWorld(el, c));
    let min = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      min = Math.min(min, distToSegment(p.x, p.y, a.x, a.y, b.x, b.y));
    }
    return min;
  }
  // rect / rounded / text / image: use corners (approx rounded corners with square bounds)
  const corners = geom.corners.map((c) => localToWorld(el, c));
  let min = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    min = Math.min(min, distToSegment(p.x, p.y, a.x, a.y, b.x, b.y));
  }
  return min;
};

/** Find nearest shape element within maxDist of a world point (for connector binding). */
export const nearestShape = (els: Element[], p: Point, maxDist: number): Element | null => {
  let best: Element | null = null;
  let bestDist = maxDist;
  for (const el of els) {
    if (el.type === "line" || el.type === "arrow" || el.type === "pencil" || el.type === "text") continue;
    const d = distanceToShape(el, p);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
};

/** For a bound connector, compute the world-space attachment point on the bound element. */
export const attachmentPoint = (
  el: Element,
  fromWorld: Point,
): Point => {
  const geom = shapeLocalGeometry(el as ShapeElement);
  const localFrom = worldToLocal(el, fromWorld);
  const cx = geom.cx;
  const cy = geom.cy;

  if (geom.kind === "ellipse") {
    const a = Math.atan2(localFrom.y - cy, localFrom.x - cx);
    const hw = el.width / 2;
    const hh = el.height / 2;
    const edge = { x: cx + Math.cos(a) * hw, y: cy + Math.sin(a) * hh };
    return localToWorld(el, edge);
  }

  if (geom.kind === "diamond") {
    const corners = geom.corners;
    // intersection of line from center to localFrom with diamond edges
    const out = rayIntersectPolygon({ x: cx, y: cy }, localFrom, corners);
    return out ? localToWorld(el, out) : { x: cx, y: cy };
  }

  // rectangle: intersect ray with rect edges (local coords)
  const w = el.width;
  const h = el.height;
  const left = el.x;
  const right = el.x + w;
  const top = el.y;
  const bottom = el.y + h;
  // param line from center
  const segments = [
    { a: { x: left, y: top }, b: { x: right, y: top } },
    { a: { x: right, y: top }, b: { x: right, y: bottom } },
    { a: { x: right, y: bottom }, b: { x: left, y: bottom } },
    { a: { x: left, y: bottom }, b: { x: left, y: top } },
  ];
  let bestT = Infinity;
  let bestP = { x: cx, y: cy };
  for (const seg of segments) {
    const p = raySegmentIntersect({ x: cx, y: cy }, localFrom, seg.a, seg.b);
    if (p) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestT) {
        bestT = d;
        bestP = p;
      }
    }
  }
  return localToWorld(el, bestP);
};

export const raySegmentIntersect = (
  o: Point,
  dir: Point,
  a: Point,
  b: Point,
): Point | null => {
  const r = { x: dir.x - o.x, y: dir.y - o.y };
  const s = { x: b.x - a.x, y: b.y - a.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((a.x - o.x) * s.y - (a.y - o.y) * s.x) / denom;
  const u = ((a.x - o.x) * r.y - (a.y - o.y) * r.x) / denom;
  if (t >= 0 && u >= 0 && u <= 1) {
    return { x: o.x + t * r.x, y: o.y + t * r.y };
  }
  return null;
};

export const rayIntersectPolygon = (o: Point, dir: Point, corners: Point[]): Point | null => {
  let best: Point | null = null;
  let bestD = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const p = raySegmentIntersect(o, dir, corners[i], corners[(i + 1) % corners.length]);
    if (p) {
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
};

/** Compute arrowhead triangle given tip point and direction (world space). */
export const arrowhead = (
  tip: Point,
  dir: Point,
  size = 14,
): [Point, Point, Point] => {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const ang = Math.atan2(uy, ux);
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  const b1 = {
    x: tip.x + Math.cos(a1) * size,
    y: tip.y + Math.sin(a1) * size,
  };
  const b2 = {
    x: tip.x + Math.cos(a2) * size,
    y: tip.y + Math.sin(a2) * size,
  };
  return [tip, b1, b2];
};

/** All four rotated corners of an element's bounding box (world space). */
export const rotatedCorners = (el: Element): Point[] => {
  const b = elementBounds(el);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const pts = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  return pts.map((p) => rotatePoint(p.x, p.y, cx, cy, el.angle));
};

/** Is the point inside the rotated bounding box of any selected element (used to pick which to move)? */
export const hitTestElementBounds = (el: Element, p: Point): boolean => {
  const b = elementBounds(el);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return pointInRotatedRect(p.x, p.y, cx, cy, b.maxX - b.minX, b.maxY - b.minY, el.angle);
};