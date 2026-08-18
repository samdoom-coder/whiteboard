import type {
  Element,
  ImageElement,
  LineElement,
  Point,
  ShapeElement,
  StickyElement,
  TextElement,
} from "../types";
import { genRoughShape, roughLinePoints, smoothPencil } from "./rough";
import { arrowhead, attachmentPoint, elementBounds } from "./geometry";
import { clamp01 } from "../util/math";
import { shade } from "../util/color";

const roughCache = new WeakMap<Element, ReturnType<typeof genRoughShape>>();
const imageCache = new Map<string, HTMLImageElement>();
const imageLoadQueue = new Map<string, Promise<HTMLImageElement>>();

export const getImage = (src: string): HTMLImageElement | null => {
  const cached = imageCache.get(src);
  if (cached) return cached;
  if (!imageLoadQueue.has(src)) {
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    }).then((img) => {
      imageCache.set(src, img);
      imageLoadQueue.delete(src);
      return img;
    });
    imageLoadQueue.set(src, p);
  }
  return null;
};

export const getRough = (el: ShapeElement) => {
  let r = roughCache.get(el);
  if (!r) {
    r = genRoughShape(el);
    roughCache.set(el, r);
  }
  return r;
};

export const clearImageCache = () => {
  imageCache.clear();
  imageLoadQueue.clear();
};

const strokePattern = (ctx: CanvasRenderingContext2D, el: Element) => {
  ctx.setLineDash([]);
  if (el.strokeStyle === "dashed") {
    const d = Math.max(3, el.strokeWidth * 2.2);
    ctx.setLineDash([d, d * 1.4]);
  } else if (el.strokeStyle === "dotted") {
    ctx.setLineDash([1, Math.max(4, el.strokeWidth * 3)]);
    ctx.lineCap = "round";
  }
};

const applyStyle = (ctx: CanvasRenderingContext2D, el: Element) => {
  ctx.globalAlpha = clamp01(el.opacity);
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = Math.max(1, el.strokeWidth);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash([]);
};

const strokePath = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
};

/** Stroke a closed point list as a smooth curve (quadratic through midpoints). */
const strokeSmoothPath = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
  if (pts.length < 3) return;
  const n = pts.length;
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  const firstMid = mid(pts[n - 1], pts[0]);
  ctx.moveTo(firstMid.x, firstMid.y);
  for (let i = 0; i < n; i++) {
    const next = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, next.x, next.y);
  }
  ctx.closePath();
  ctx.stroke();
};

const fillPath = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
};

const hachureFill = (ctx: CanvasRenderingContext2D, rough: ReturnType<typeof genRoughShape>, fillColor: string, opacity: number) => {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  const poly = rough.fillPolygon;
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 1.4;
  for (const line of rough.hachure) strokePath(ctx, line);
  for (const line of rough.crosshatch) strokePath(ctx, line);
  ctx.restore();
};

const drawShape = (ctx: CanvasRenderingContext2D, el: ShapeElement) => {
  if (el.type === "text") return;
  const rough = getRough(el);
  if (!rough) return;

  // rotate around center
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(el.angle);
  ctx.translate(-cx, -cy);

  // fill
  const hasFill = el.backgroundColor !== "transparent" && el.backgroundColor !== "rgba(0,0,0,0)";
  if (el.type === "image") {
    const img = getImage((el as ImageElement).dataURL);
    if (img) {
      ctx.globalAlpha = clamp01(el.opacity);
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    }
    ctx.globalAlpha = 1;
  } else if (hasFill) {
    if (el.fillStyle === "solid") {
      ctx.save();
      ctx.globalAlpha = clamp01(el.opacity);
      ctx.fillStyle = el.backgroundColor;
      fillPath(ctx, rough.fillPolygon);
      ctx.restore();
    } else {
      hachureFill(ctx, rough, el.backgroundColor, clamp01(el.opacity));
    }
  }

  // stroke with sketch double-line effect
  applyStyle(ctx, el);
  strokePattern(ctx, el);
  const smooth = el.type === "ellipse" || el.type === "roundedRectangle";
  if (smooth) strokeSmoothPath(ctx, rough.outline);
  else strokePath(ctx, rough.outline);
  if (el.roughness > 0.15) {
    ctx.globalAlpha = clamp01(el.opacity) * 0.35;
    ctx.lineWidth = Math.max(1, el.strokeWidth * 0.5);
    if (smooth) strokeSmoothPath(ctx, rough.secondOutline);
    else strokePath(ctx, rough.secondOutline);
  }
  ctx.restore();
};

export const drawText = (ctx: CanvasRenderingContext2D, el: TextElement) => {
  const font = `${el.textBold ? "700" : "400"} ${el.fontSize}px ${el.fontFamily}`;
  ctx.save();
  ctx.globalAlpha = clamp01(el.opacity);
  ctx.font = font;
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = "top";
  const lines = el.text.split("\n");
  const lineHeight = el.fontSize * 1.25;
  const w = el.width || measureTextWidth(el);
  lines.forEach((line, i) => {
    const lw = ctx.measureText(line).width;
    let x = el.x;
    if (el.textAlign === "center") x = el.x + (w - lw) / 2;
    else if (el.textAlign === "right") x = el.x + w - lw;
    ctx.fillText(line, x, el.y + i * lineHeight);
  });
  ctx.restore();
};

export const STICKY_PAD = 10;

let stickyMeasureCtx: CanvasRenderingContext2D | null = null;
const getStickyMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (!stickyMeasureCtx) stickyMeasureCtx = document.createElement("canvas").getContext("2d");
  return stickyMeasureCtx;
};

/** Greedy word-wrap that also breaks words wider than maxWidth. */
export const wrapTextLines = (
  text: string,
  maxWidth: number,
  ctx?: CanvasRenderingContext2D | null,
): string[] => {
  const c = ctx ?? getStickyMeasureCtx();
  if (!c || maxWidth <= 0) return text ? [text] : [""];
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (c.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        if (line) out.push(line);
        line = word;
        while (line.length > 1 && c.measureText(line).width > maxWidth) {
          let lo = 1;
          let hi = line.length;
          let best = 1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (c.measureText(line.slice(0, mid)).width <= maxWidth) {
              best = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          out.push(line.slice(0, best));
          line = line.slice(best);
        }
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
};

/** Size a sticky note so its (wrapped) text fits inside with padding. */
export const fitStickyElement = (el: StickyElement): StickyElement => {
  const c = getStickyMeasureCtx();
  const font = `${el.textBold ? "700" : "400"} ${el.fontSize}px ${el.fontFamily}`;
  if (c) c.font = font;
  const widestToken = (el.text.match(/\S+/g) || [""]).reduce(
    (m, t) => Math.max(m, c ? c.measureText(t).width : t.length * el.fontSize * 0.6),
    0,
  );
  const availW = Math.max(60, el.width - STICKY_PAD * 2, widestToken);
  const lines = wrapTextLines(el.text, availW, c);
  const lineHeight = el.fontSize * 1.25;
  const w = Math.max(el.width, Math.ceil(availW + STICKY_PAD * 2));
  const h = Math.max(el.height, Math.ceil(lines.length * lineHeight + STICKY_PAD * 2 + 2));
  if (w === el.width && h === el.height) return el;
  return { ...el, width: w, height: h };
};

/** Draw a sticky note: filled rounded body, folded corner, and text. */
const drawStickyText = (ctx: CanvasRenderingContext2D, el: StickyElement) => {
  const font = `${el.textBold ? "700" : "400"} ${el.fontSize}px ${el.fontFamily}`;
  ctx.save();
  ctx.globalAlpha = clamp01(el.opacity);
  ctx.font = font;
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = "top";
  const maxW = Math.max(60, el.width - STICKY_PAD * 2);
  const lines = wrapTextLines(el.text, maxW, ctx);
  const lineHeight = el.fontSize * 1.25;
  let y = el.y + STICKY_PAD;
  for (const line of lines) {
    const lw = ctx.measureText(line).width;
    let x = el.x + STICKY_PAD;
    if (el.textAlign === "center") x = el.x + (el.width - lw) / 2;
    else if (el.textAlign === "right") x = el.x + el.width - lw - STICKY_PAD;
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  ctx.restore();
};

const drawSticky = (ctx: CanvasRenderingContext2D, el: StickyElement, editing = false) => {
  const rough = getRough(el);
  if (!rough) return;

  // rotate around center
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(el.angle);
  ctx.translate(-cx, -cy);

  // fill
  const fill = el.backgroundColor !== "transparent" && el.backgroundColor !== "rgba(0,0,0,0)"
    ? el.backgroundColor
    : "#ffd43b";
  if (el.fillStyle === "solid" || !rough.hachure.length) {
    ctx.save();
    ctx.globalAlpha = clamp01(el.opacity);
    ctx.fillStyle = fill;
    fillPath(ctx, rough.fillPolygon);
    ctx.restore();
  } else {
    hachureFill(ctx, rough, fill, clamp01(el.opacity));
  }

  // outline
  applyStyle(ctx, el);
  strokePattern(ctx, el);
  strokePath(ctx, rough.outline);
  if (el.roughness > 0.15) {
    ctx.globalAlpha = clamp01(el.opacity) * 0.35;
    ctx.lineWidth = Math.max(1, el.strokeWidth * 0.5);
    strokePath(ctx, rough.secondOutline);
    ctx.globalAlpha = clamp01(el.opacity);
    ctx.lineWidth = Math.max(1, el.strokeWidth);
  }

  // folded top-right corner (dog-ear)
  const f = Math.max(10, Math.min(22, el.width * 0.22, el.height * 0.22));
  const darker = shade(fill, -0.12);
  ctx.save();
  ctx.globalAlpha = clamp01(el.opacity);
  ctx.fillStyle = darker;
  ctx.beginPath();
  ctx.moveTo(el.x + el.width, el.y);
  ctx.lineTo(el.x + el.width - f, el.y);
  ctx.lineTo(el.x + el.width, el.y + f);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darker;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(el.x + el.width - f, el.y);
  ctx.lineTo(el.x + el.width, el.y + f);
  ctx.stroke();
  ctx.restore();

  // text on top (skipped while editing; the DOM editor renders it)
  if (el.text && !editing) {
    ctx.save();
    const poly = rough.fillPolygon;
    if (poly.length) {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.clip();
    }
    drawStickyText(ctx, el);
    ctx.restore();
  }

  ctx.restore();
};

export const measureTextWidth = (el: TextElement, ctx?: CanvasRenderingContext2D) => {
  const font = `${el.textBold ? "700" : "400"} ${el.fontSize}px ${el.fontFamily}`;
  const lines = el.text.split("\n");
  let max = 0;
  if (ctx) {
    ctx.save();
    ctx.font = font;
    for (const line of lines) max = Math.max(max, ctx.measureText(line).width);
    ctx.restore();
  } else {
    // estimate
    const c = document.createElement("canvas").getContext("2d");
    if (c) {
      c.font = font;
      for (const line of lines) max = Math.max(max, c.measureText(line).width);
    } else {
      max = lines.reduce((m, l) => Math.max(m, l.length * el.fontSize * 0.6), 0);
    }
  }
  return max;
};

export const measureLines = (
  text: string,
  fontSize: number,
  fontFamily: string,
  bold: boolean,
): { width: number; height: number } => {
  const font = `${bold ? "700" : "400"} ${fontSize}px ${fontFamily}`;
  const lines = text.split("\n");
  let max = 0;
  const c = document.createElement("canvas").getContext("2d");
  if (c) {
    c.font = font;
    for (const line of lines) max = Math.max(max, c.measureText(line).width);
  } else {
    max = lines.reduce((m, l) => Math.max(m, l.length * fontSize * 0.6), 0);
  }
  return { width: max, height: lines.length * fontSize * 1.25 };
};

export const textHeight = (el: TextElement) => el.text.split("\n").length * el.fontSize * 1.25;

export const resizeTextElement = (el: TextElement): TextElement => {
  const w = measureTextWidth(el);
  const h = textHeight(el);
  return { ...el, width: w, height: h };
};

const drawLineElement = (ctx: CanvasRenderingContext2D, el: LineElement) => {
  const { primary, secondary } = roughLinePoints(el);
  const pts = primary.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));

  // rotate around start? Excalidraw rotates lines around their start point.
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.angle);
  ctx.translate(-el.x, -el.y);

  applyStyle(ctx, el);
  strokePattern(ctx, el);

  const drawMain = (path: Point[]) => {
    const world = path.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    strokePath(ctx, world);
  };
  drawMain(primary);
  if (el.roughness > 0.05 && el.strokeStyle === "solid") {
    ctx.globalAlpha = clamp01(el.opacity) * 0.5;
    ctx.lineWidth = Math.max(1, el.strokeWidth * 0.6);
    drawMain(secondary);
    ctx.globalAlpha = clamp01(el.opacity);
    ctx.lineWidth = Math.max(1, el.strokeWidth);
  }

  if (el.type === "arrow") {
    // arrowhead at last point, pointing away from previous point
    const n = pts.length;
    const tip = pts[n - 1];
    const before = pts[n - 2] || tip;
    const dir = { x: tip.x - before.x, y: tip.y - before.y };
    const head = arrowhead(tip, dir, Math.max(10, el.strokeWidth * 5));
    ctx.beginPath();
    ctx.moveTo(head[0].x, head[0].y);
    ctx.lineTo(head[1].x, head[1].y);
    ctx.lineTo(head[2].x, head[2].y);
    ctx.closePath();
    ctx.fillStyle = el.strokeColor;
    ctx.globalAlpha = clamp01(el.opacity);
    ctx.fill();
  }
  ctx.restore();
};

const drawPencil = (ctx: CanvasRenderingContext2D, el: Element) => {
  if (el.type !== "pencil") return;
  const pts = smoothPencil(el).map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.angle);
  ctx.translate(-el.x, -el.y);
  applyStyle(ctx, el);
  strokePattern(ctx, el);
  strokePath(ctx, pts);
  ctx.restore();
};

const drawTextElement = (ctx: CanvasRenderingContext2D, el: TextElement) => {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(el.angle);
  ctx.translate(-cx, -cy);
  drawText(ctx, el);
  ctx.restore();
};

export const drawElement = (
  ctx: CanvasRenderingContext2D,
  el: Element,
  opts: { editingTextId?: string | null } = {},
) => {
  if (el.isDeleted) return;
  if (opts.editingTextId === el.id && el.type === "text") return; // drawn by the DOM editor

  switch (el.type) {
    case "rectangle":
    case "roundedRectangle":
    case "ellipse":
    case "diamond":
    case "image":
      drawShape(ctx, el);
      break;
    case "sticky":
      drawSticky(ctx, el as StickyElement, opts.editingTextId === el.id);
      break;
    case "line":
    case "arrow":
      drawLineElement(ctx, el);
      break;
    case "pencil":
      drawPencil(ctx, el);
      break;
    case "text":
      drawTextElement(ctx, el as TextElement);
      break;
  }
};

/**
 * Draw a connector's attachment point on its bound element.
 * Returns the resolved world-space endpoints for the line.
 */
export const resolveLineEndpoints = (
  el: LineElement,
  elements: Element[],
): { pts: Point[]; start: Point; end: Point } => {
  const pts = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
  const out = { pts: pts.slice(), start: pts[0], end: pts[pts.length - 1] };
  if (el.startBinding) {
    const target = elements.find((e) => e.id === el.startBinding?.elementId);
    if (target && target.type !== "line" && target.type !== "arrow" && target.type !== "pencil") {
      out.start = attachmentPoint(target, pts[1] ?? out.end);
    }
  }
  if (el.endBinding) {
    const target = elements.find((e) => e.id === el.endBinding?.elementId);
    if (target && target.type !== "line" && target.type !== "arrow" && target.type !== "pencil") {
      out.end = attachmentPoint(target, pts[pts.length - 2] ?? out.start);
    }
  }
  out.pts[0] = out.start;
  out.pts[out.pts.length - 1] = out.end;
  return out;
};

export const visibleElementBounds = (el: Element, elements: Element[]) => {
  if (el.type === "line" || el.type === "arrow") {
    const { pts } = resolveLineEndpoints(el, elements);
    const b = elementBounds(el);
    for (const p of pts) {
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x);
      b.maxY = Math.max(b.maxY, p.y);
    }
    return b;
  }
  return elementBounds(el);
};