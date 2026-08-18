import type { Document, Element, ExportSettings, ImageElement, LineElement, Point, ShapeElement, TextElement, Theme } from "../types";
import { boundsFromElements } from "../render/geometry";
import { genRoughShape, roughLinePoints, smoothPencil } from "../render/rough";
import { resolveLineEndpoints, getImage, drawElement } from "../render/renderer";
import { arrowhead } from "../render/geometry";
import { palettes } from "../util/color";

const OFFSET = 20;

const computeExportBounds = (
  elements: Element[],
  opts: ExportSettings,
) => {
  if (opts.onlySelected && elements.length) {
    const b = boundsFromElements(elements);
    return {
      minX: b!.minX - OFFSET,
      minY: b!.minY - OFFSET,
      maxX: b!.maxX + OFFSET,
      maxY: b!.maxY + OFFSET,
    };
  }
  const b = boundsFromElements(elements);
  if (!b) {
    return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  }
  return { minX: b.minX - OFFSET, minY: b.minY - OFFSET, maxX: b.maxX + OFFSET, maxY: b.maxY + OFFSET };
};

export const exportToPNG = async (
  elements: Element[],
  opts: ExportSettings,
  _theme: Theme,
  bgColor: string,
): Promise<string> => {
  const bounds = computeExportBounds(elements, opts);
  const w = Math.max(1, Math.round((bounds.maxX - bounds.minX) * opts.scale));
  const h = Math.max(1, Math.round((bounds.maxY - bounds.minY) * opts.scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");
  ctx.scale(opts.scale, opts.scale);
  ctx.translate(-bounds.minX, -bounds.minY);

  // background
  if (!opts.transparentBackground) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // wait for all images to be loaded
  const imageSrcs = elements.filter((e) => e.type === "image").map((e) => (e as { dataURL: string }).dataURL);
  await Promise.all(
    imageSrcs.map((src) => new Promise<void>((res) => {
      const img = getImage(src);
      if (img?.complete) return res();
      setTimeout(res, 200);
    })),
  );

  for (const el of elements) {
    drawElement(ctx, el, { editingTextId: null });
  }
  return canvas.toDataURL("image/png");
};

export const svgColor = (c: string) => c;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pathFromPoints = (pts: Point[], closePath = false) => {
  if (!pts.length) return "";
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  }
  if (closePath) d += " Z";
  return d;
};

const shapeSvg = (el: Element): string[] => {
  const parts: string[] = [];
  const wrap = `<g transform="rotate(${((-el.angle * 180) / Math.PI).toFixed(2)} ${(el.x + el.width / 2).toFixed(2)} ${(el.y + el.height / 2).toFixed(2)})">`;
  const close = `</g>`;

  if (el.type === "text") {
    const te = el as TextElement;
    const lines = te.text.split("\n");
    const lh = te.fontSize * 1.25;
    let textSvg = `<text x="${el.x}" y="${el.y}" font-size="${te.fontSize}" font-family="${te.fontFamily}" font-weight="${te.textBold ? 700 : 400}" fill="${el.strokeColor}" opacity="${el.opacity}">`;
    lines.forEach((line, i) => {
      const tspan = `<tspan x="${el.x}" dy="${i === 0 ? 0 : lh}">${esc(line) || " "}</tspan>`;
      textSvg += tspan;
    });
    textSvg += `</text>`;
    parts.push(wrap + textSvg + close);
    return parts;
  }

  if (el.type === "image") {
    const ie = el as ImageElement;
    parts.push(
      `${wrap}<image href="${ie.dataURL}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity}"/>${close}`,
    );
    return parts;
  }

  const rough = genRoughShape(el as ShapeElement);
  const hasFill = el.backgroundColor && el.backgroundColor !== "transparent";

  let inner = "";

  if (hasFill) {
    if (el.fillStyle === "solid") {
      inner += `<path d="${pathFromPoints(rough.fillPolygon, true)}" fill="${el.backgroundColor}" opacity="${el.opacity}"/>`;
    } else {
      const lines = [...rough.hachure, ...rough.crosshatch];
      inner += `<clipPath id="clip-${el.id}"><path d="${pathFromPoints(rough.fillPolygon, true)}"/></clipPath>`;
      const hachureLines = lines
        .map((l) => `<path d="${pathFromPoints(l)}" stroke="${el.backgroundColor}" stroke-width="1.4" opacity="${el.opacity}" fill="none"/>`)
        .join("");
      inner += `<g clip-path="url(#clip-${el.id})">${hachureLines}</g>`;
    }
  }

  const dash =
    el.strokeStyle === "dashed"
      ? `stroke-dasharray="${Math.max(3, el.strokeWidth * 2.2)} ${Math.max(3, el.strokeWidth * 2.2) * 1.4}"`
      : el.strokeStyle === "dotted"
        ? `stroke-dasharray="1 ${Math.max(4, el.strokeWidth * 3)}" stroke-linecap="round"`
        : "";
  inner += `<path d="${pathFromPoints(rough.outline, true)}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${el.opacity}" ${dash}/>`;

  parts.push(wrap + inner + close);
  return parts;
};

const lineSvg = (el: Element, elements: Element[]): string[] => {
  const parts: string[] = [];
  const le = el as LineElement;
  const { primary } = roughLinePoints(le);
  const resolved = resolveLineEndpoints(le, elements);
  // rebuild primary relative to resolved endpoints
  const pts = primary.map((p, i) => {
    if (i === 0) return resolved.start;
    if (i === primary.length - 1) return resolved.end;
    return { x: el.x + p.x, y: el.y + p.y };
  });
  const dash =
    el.strokeStyle === "dashed"
      ? `stroke-dasharray="${Math.max(3, el.strokeWidth * 2.2)} ${Math.max(3, el.strokeWidth * 2.2) * 1.4}"`
      : el.strokeStyle === "dotted"
        ? `stroke-dasharray="1 ${Math.max(4, el.strokeWidth * 3)}" stroke-linecap="round"`
        : "";
  const g = `<g transform="rotate(${((-el.angle * 180) / Math.PI).toFixed(2)} ${el.x.toFixed(2)} ${el.y.toFixed(2)})">`;
  parts.push(
    `${g}<path d="${pathFromPoints(pts)}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${el.opacity}" ${dash}/>`,
  );
  if (el.type === "arrow") {
    const last = pts[pts.length - 1];
    const before = pts[pts.length - 2] ?? last;
    const dir = { x: last.x - before.x, y: last.y - before.y };
    const head = arrowhead(last, dir, Math.max(10, el.strokeWidth * 5));
    parts.push(
      `<path d="M ${head[0].x} ${head[0].y} L ${head[1].x} ${head[1].y} L ${head[2].x} ${head[2].y} Z" fill="${el.strokeColor}" opacity="${el.opacity}"/>`,
    );
  }
  parts.push(`</g>`);
  return parts;
};

const pencilSvg = (el: Element): string[] => {
  const pts = smoothPencil(el).map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
  const dash =
    el.strokeStyle === "dashed"
      ? `stroke-dasharray="${Math.max(3, el.strokeWidth * 2.2)} ${Math.max(3, el.strokeWidth * 2.2) * 1.4}"`
      : el.strokeStyle === "dotted"
        ? `stroke-dasharray="1 ${Math.max(4, el.strokeWidth * 3)}" stroke-linecap="round"`
        : "";
  return [
    `<g transform="rotate(${((-el.angle * 180) / Math.PI).toFixed(2)} ${el.x.toFixed(2)} ${el.y.toFixed(2)})">` +
      `<path d="${pathFromPoints(pts)}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${el.opacity}" ${dash}/>` +
      `</g>`,
  ];
};

export const exportToSVG = (
  elements: Element[],
  opts: ExportSettings,
  _theme: Theme,
  bgColor: string,
): string => {
  const bounds = computeExportBounds(elements, opts);
  const w = (bounds.maxX - bounds.minX).toFixed(2);
  const h = (bounds.maxY - bounds.minY).toFixed(2);
  const scale = opts.scale;

  const defs = [];
  const body: string[] = [];
  for (const el of elements) {
    if (el.type === "image") {
      const ie = el as ImageElement;
      defs.push(`<image id="svg-img-${el.id}" href="${ie.dataURL}"/>`);
    }
  }

  for (const el of elements) {
    if (el.type === "line" || el.type === "arrow") {
      body.push(...lineSvg(el, elements));
    } else if (el.type === "pencil") {
      body.push(...pencilSvg(el));
    } else {
      body.push(...shapeSvg(el as ShapeElement));
    }
  }

  const bgRect = opts.transparentBackground
    ? ""
    : `<rect x="0" y="0" width="${w}" height="${h}" fill="${bgColor}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(
    Number(w) * scale
  ).toFixed(2)}" height="${(Number(h) * scale).toFixed(2)}" viewBox="0 0 ${w} ${h}" font-family="Inter, system-ui, sans-serif">
<defs>${defs.join("")}</defs>
${bgRect}
<g transform="translate(${(-bounds.minX).toFixed(2)} ${(-bounds.minY).toFixed(2)})">
${body.join("\n")}
</g>
</svg>`;
};

export const downloadBlob = (data: string, filename: string, mime: string) => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportToJSON = (doc: Document, onlySelected: boolean, selectedIds: string[]): string => {
  const elements = onlySelected
    ? doc.elements.filter((e) => selectedIds.includes(e.id))
    : doc.elements;
  return JSON.stringify(
    { ...doc, elements, __app: "scribble-whiteboard", __v: 1 },
    null,
    2,
  );
};

export const importFromJSON = (text: string): Document | null => {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.elements)) return null;
    const doc: Document = {
      id: parsed.id ?? `doc-${Date.now()}`,
      name: parsed.name ?? parsed.scene?.name ?? "Imported whiteboard",
      createdAt: parsed.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      version: parsed.version ?? 1,
      scene: {
        name: parsed.name ?? parsed.scene?.name ?? "Imported whiteboard",
        background: parsed.scene?.background ?? "dots",
        backgroundColor: parsed.scene?.backgroundColor ?? palettes.light.canvasBackground,
        view: parsed.scene?.view ?? { scrollX: 0, scrollY: 0, zoom: 1 },
        version: 1,
      },
      elements: parsed.elements.filter((e: unknown) => {
        const el = e as Record<string, unknown>;
        return (
          el &&
          typeof el.id === "string" &&
          typeof el.type === "string" &&
          typeof el.x === "number" &&
          typeof el.y === "number"
        );
      }),
    };
    return doc;
  } catch {
    return null;
  }
};

export const downloadJSON = (doc: Document, onlySelected: boolean, selectedIds: string[]) => {
  const data = exportToJSON(doc, onlySelected, selectedIds);
  downloadBlob(data, `${doc.scene.name.replace(/\s+/g, "-").toLowerCase() || "whiteboard"}.json`, "application/json");
};