import type { Element, LineElement, Point, ShapeElement } from "../types";
import { SeededRandom } from "../util/prng";
import { smoothPath } from "../util/math";
import { elementBounds } from "./geometry";

export interface RoughShape {
  /** closed smooth polygon used for solid fill + clipping */
  fillPolygon: Point[];
  /** closed jittered outline used for the stroke */
  outline: Point[];
  /** hachure fill lines */
  hachure: Point[][];
  /** cross-hatch fill lines */
  crosshatch: Point[][];
  /** a second, slightly different outline pass for the sketch effect */
  secondOutline: Point[];
}

const lerpP = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const close = (pts: Point[]): Point[] => {
  const out = pts.slice();
  if (out.length && (out[0].x !== out[out.length - 1].x || out[0].y !== out[out.length - 1].y)) {
    out.push({ ...out[0] });
  }
  return out;
};

/**
 * Jitter a polyline to look hand-drawn. roughness 0..1 scales wobble relative to overall size.
 */
const jitter = (pts: Point[], seed: number, roughness: number): Point[] => {
  if (roughness <= 0.01 || pts.length < 2) return pts;
  const rnd = new SeededRandom(seed);
  // overall size for scale
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  sx /= pts.length;
  sy /= pts.length;
  let maxD = 0;
  for (const p of pts) maxD = Math.max(maxD, Math.hypot(p.x - sx, p.y - sy));
  const amp = Math.min(1.6, maxD * 0.03 + 0.3) * roughness;
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0 || i === pts.length - 1) {
      out.push({ ...p });
      continue;
    }
    const nx = rnd.range(-1, 1);
    const ny = rnd.range(-1, 1);
    out.push({ x: p.x + nx * amp, y: p.y + ny * amp });
  }
  return out;
};

/** Subdivide each segment so hand-drawn wobble has vertices to work with. */
const subdivide = (pts: Point[], per = 3): Point[] => {
  const out: Point[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (let s = 1; s <= per; s++) {
      out.push(lerpP(a, b, s / per));
    }
  }
  return out;
};

/** Generate hachure lines across a bounding box with a slope. */
const hachureLines = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  seed: number,
  spacing: number,
  angleDeg: number,
): Point[][] => {
  const rnd = new SeededRandom(seed ^ 0x9e3779b9);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // rotate bounding box
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const halfDiag = Math.hypot(w, h) / 2 + spacing;
  const lines: Point[][] = [];
  for (let d = -halfDiag; d <= halfDiag; d += spacing) {
    // line perpendicular to slope at offset d
    const px = -sin;
    const py = cos;
    const ax = cx + px * d - cos * halfDiag;
    const ay = cy + py * d - sin * halfDiag;
    const bx = cx + px * d + cos * halfDiag;
    const by = cy + py * d + sin * halfDiag;
    const wobble = rnd.range(-0.4, 0.4);
    const jx = rnd.range(-0.3, 0.3);
    const jy = rnd.range(-0.3, 0.3);
    lines.push([
      { x: ax + jx - sin * wobble, y: ay + jy + cos * wobble },
      { x: bx + jx + sin * wobble, y: by + jy - cos * wobble },
    ]);
  }
  return lines;
};

const rectOutline = (x: number, y: number, w: number, h: number, radius: number): Point[] => {
  if (radius <= 0) {
    return close([
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]);
  }
  const r = Math.min(radius, w / 2, h / 2);
  const pts: Point[] = [];
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  arc(x + r, y + r, Math.PI, Math.PI * 1.5);
  arc(x + w - r, y + r, Math.PI * 1.5, Math.PI * 2);
  arc(x + w - r, y + h - r, 0, Math.PI * 0.5);
  arc(x + r, y + h - r, Math.PI * 0.5, Math.PI);
  return close(pts);
};

const ellipseOutline = (cx: number, cy: number, rx: number, ry: number): Point[] => {
  const pts: Point[] = [];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
};

export const genRoughShape = (el: ShapeElement): RoughShape => {
  const rough = Math.min(1, Math.max(0, el.roughness));
  const seed = el.seed;
  const w = el.width;
  const h = el.height;

  let base: Point[];
  let fillPolygon: Point[];
  switch (el.type) {
    case "rectangle":
      base = rectOutline(el.x, el.y, w, h, 0);
      fillPolygon = base;
      break;
    case "roundedRectangle": {
      const r = Math.min(w, h) * (0.1 + 0.35 * el.roundness);
      base = rectOutline(el.x, el.y, w, h, r);
      fillPolygon = rectOutline(el.x, el.y, w, h, r * 0.98);
      break;
    }
    case "sticky": {
      const r = Math.min(14, w * 0.08, h * 0.08);
      base = rectOutline(el.x, el.y, w, h, r);
      fillPolygon = rectOutline(el.x, el.y, w, h, r * 0.98);
      break;
    }
    case "ellipse": {
      const cx = el.x + w / 2;
      const cy = el.y + h / 2;
      base = ellipseOutline(cx, cy, w / 2, h / 2);
      fillPolygon = ellipseOutline(cx, cy, w / 2 * 0.99, h / 2 * 0.99);
      break;
    }
    case "diamond": {
      const cx = el.x + w / 2;
      const cy = el.y + h / 2;
      base = close([
        { x: cx, y: el.y },
        { x: el.x + w, y: cy },
        { x: cx, y: el.y + h },
        { x: el.x, y: cy },
      ]);
      fillPolygon = base;
      break;
    }
    case "text": {
      base = rectOutline(el.x, el.y, w, h, 0);
      fillPolygon = base;
      break;
    }
    case "image": {
      base = rectOutline(el.x, el.y, w, h, 0);
      fillPolygon = base;
      break;
    }
  }

  // solid fill: keep smooth. hachure: jitter slightly.
  const bounds = {
    minX: el.x,
    minY: el.y,
    maxX: el.x + w,
    maxY: el.y + h,
  };

  // hachure spacing depends on strokeWidth so it scales
  const spacing = Math.max(4, 14 * (0.8 + el.strokeWidth * 0.3));

  let hachure: Point[][] = [];
  let crosshatch: Point[][] = [];
  if (el.fillStyle === "hachure") {
    hachure = hachureLines(bounds, seed, spacing, 45);
  } else if (el.fillStyle === "crosshatch") {
    hachure = hachureLines(bounds, seed, spacing, 45);
    crosshatch = hachureLines(bounds, seed ^ 0xdeadbeef, spacing, -45);
  }

  // outline with double-line sketch effect: jitter with two passes
  const detailed = subdivide(base, 2);
  const outline1 = jitter(detailed, seed, rough);
  const outline2 = jitter(subdivide(detailed, 2), seed ^ 0xabcdef01, rough * 0.8);

  // merge into a single polyline for single stroke? Excalidraw draws two strokes.
  // We'll keep both for renderer to draw.
  return {
    fillPolygon: fillPolygon as Point[],
    outline: outline1 as Point[],
    hachure,
    crosshatch,
    secondOutline: outline2 as Point[],
  };
};

/** Straight / arrow elements: rough stroke path. */
export const roughLinePoints = (el: LineElement): { primary: Point[]; secondary: Point[] } => {
  const rough = Math.min(1, Math.max(0, el.roughness));
  if (el.type === "arrow" && el.points.length === 2) {
    // arrows: keep mostly straight, subtle wobble
    const a = el.points[0];
    const b = el.points[1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const jx = (new SeededRandom(el.seed).range(-1, 1)) * rough * 3;
    const jy = (new SeededRandom(el.seed ^ 1).range(-1, 1)) * rough * 3;
    const primary = [a, { x: mid.x + jx, y: mid.y + jy }, b];
    const secondary = [a, b];
    return { primary, secondary };
  }
  if (el.points.length <= 2) {
    const seed = el.seed;
    const a = el.points[0];
    const b = el.points[1];
    const rnd = new SeededRandom(seed);
    const amp = Math.max(0.6, Math.hypot(b.x - a.x, b.y - a.y) * 0.012) * rough;
    const pts = subdivide([a, b], 6).map((p, i) => {
      if (i === 0 || i === 6) return p;
      const off = rnd.range(-amp, amp);
      const nx = -(b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
      const ny = (b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
      return { x: p.x + nx * off, y: p.y + ny * off };
    });
    return { primary: pts, secondary: [a, b] };
  }
  return { primary: el.points, secondary: el.points };
};

/** Smooth pencil points for display. */
export const smoothPencil = (el: Element): Point[] => {
  if (el.type !== "pencil") return [];
  return smoothPath(el.points, 0.15);
};

export const genRoughForExport = (el: Element) => {
  if (el.type === "line" || el.type === "arrow") return roughLinePoints(el as LineElement);
  if (el.type === "pencil") return { primary: smoothPencil(el), secondary: [] as Point[] };
  return genRoughShape(el as ShapeElement);
};

/** Bounds (world) of an element used for culling. */
export const cullBounds = (el: Element) => elementBounds(el);