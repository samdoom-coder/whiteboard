import type { Point } from "../types";

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number) => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);

export const distToSegmentSq = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
};

export const distToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => Math.sqrt(distToSegmentSq(px, py, ax, ay, bx, by));

export const normalizeAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const angleBetween = (a: number, b: number) => {
  const d = normalizeAngle(b - a);
  return d;
};

export const degreesToRadians = (deg: number) => (deg * Math.PI) / 180;
export const radiansToDegrees = (rad: number) => (rad * 180) / Math.PI;

/** Rotate a point around a center. */
export const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
};

export const pointInRect = (
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => px >= x && px <= x + w && py >= y && py <= y + h;

/** Does a point lie inside a rotated rectangle? */
export const pointInRotatedRect = (
  px: number,
  py: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
) => {
  const local = rotatePoint(px, py, cx, cy, -angle);
  return (
    Math.abs(local.x - cx) <= w / 2 && Math.abs(local.y - cy) <= h / 2
  );
};

export const smoothPath = (points: Point[], tension = 0.2): Point[] => {
  if (points.length < 3) return points.slice();
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    out.push(p1);
    for (let t = 1; t <= 8; t++) {
      const s = t / 8;
      const a = (1 - s) * (1 - s) * (1 - s);
      const b = 3 * (1 - s) * (1 - s) * s;
      const c = 3 * (1 - s) * s * s;
      const d = s * s * s;
      out.push({
        x: a * p1.x + b * cp1x + c * cp2x + d * p2.x,
        y: a * p1.y + b * cp1y + c * cp2y + d * p2.y,
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
};

export const pointsToPath = (pts: Point[]) => {
  if (!pts.length) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
};

export const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};