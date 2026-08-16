import type { Element, ElementStyle } from "../types";
import { useStore } from "../core/store";
import { specToElements, type DiagramNode, type DiagramSpec } from "./diagram";
import { makeText } from "../core/elements";
import { uid } from "../util/id";
import { elementBounds, boundsFromElements } from "../render/geometry";

export interface AIResult {
  ok: boolean;
  message: string;
  /** elements to place on the canvas (for generate) */
  elements?: Element[];
  /** replace the whole canvas with `elements` (vs append) */
  replaceCanvas?: boolean;
  /** short description shown in the panel while thinking */
  explain?: string;
}

interface Category {
  label: string;
  type: DiagramNode["type"];
  style: Partial<ElementStyle>;
  textColor?: string;
  kind?: "flow" | "aux";
  keywords: string[];
}

const CATEGORIES: Category[] = [
  { label: "Mobile App", type: "roundedRectangle", kind: "flow", style: { backgroundColor: "#a5d8ff", strokeColor: "#1864ab", fillStyle: "solid" }, textColor: "#1c2a3a", keywords: ["react native", "mobile app", "mobile", "app", "ios", "android", "client"] },
  { label: "API Gateway", type: "roundedRectangle", kind: "flow", style: { backgroundColor: "#d0bfff", strokeColor: "#5f3dc4", fillStyle: "solid" }, textColor: "#241a3d", keywords: ["api gateway", "gateway", "load balancer", "edge"] },
  { label: "Backend", type: "roundedRectangle", kind: "flow", style: { backgroundColor: "#e6e6e6", strokeColor: "#343a40", fillStyle: "solid" }, textColor: "#212529", keywords: ["backend", "server", "api service", "application server", "node.js", "express", "nginx", "web server", "service layer"] },
  { label: "Authentication", type: "roundedRectangle", kind: "aux", style: { backgroundColor: "#ffd8a8", strokeColor: "#d9480f", fillStyle: "solid" }, textColor: "#3b2410", keywords: ["authentication", "auth", "cognito", "identity", "jwt", "oauth", "sso", "login"] },
  { label: "PostgreSQL", type: "database", kind: "flow", style: { backgroundColor: "#99e9f2", strokeColor: "#0b7285", fillStyle: "solid" }, textColor: "#0b2a30", keywords: ["postgresql", "postgres", "sql", "database", "db", "mysql", "dynamodb", "mongo", "mongodb", "warehouse", "data store"] },
  { label: "Redis", type: "roundedRectangle", kind: "aux", style: { backgroundColor: "#ffc9c9", strokeColor: "#c92a2a", fillStyle: "solid" }, textColor: "#3a1414", keywords: ["redis", "cache", "memcached", "session store"] },
  { label: "S3 Storage", type: "rectangle", kind: "aux", style: { backgroundColor: "#b2f2bb", strokeColor: "#2b8a3e", fillStyle: "solid" }, textColor: "#14301d", keywords: ["s3", "storage", "bucket", "object store", "files", "cdn", "cloudfront", "gcs", "azure blob"] },
  { label: "Payment Service", type: "roundedRectangle", kind: "flow", style: { backgroundColor: "#99e9f2", strokeColor: "#0c8599", fillStyle: "solid" }, textColor: "#0b2a30", keywords: ["payment", "billing", "checkout", "stripe", "paypal", "transactions"] },
  { label: "Message Queue", type: "roundedRectangle", kind: "aux", style: { backgroundColor: "#ffec99", strokeColor: "#e8590c", fillStyle: "solid" }, textColor: "#3b2a10", keywords: ["queue", "message", "rabbitmq", "kafka", "sqs", "pub/sub", "event bus", "worker", "job"] },
  { label: "Notification", type: "roundedRectangle", kind: "aux", style: { backgroundColor: "#ffc2e6", strokeColor: "#a61e4d", fillStyle: "solid" }, textColor: "#3a1424", keywords: ["notification", "push", "email", "sms", "websocket"] },
  { label: "Analytics", type: "roundedRectangle", kind: "aux", style: { backgroundColor: "#d0bfff", strokeColor: "#5f3dc4", fillStyle: "solid" }, textColor: "#241a3d", keywords: ["analytics", "logging", "monitoring", "metrics", "observability", "grafana", "datadog"] },
];

const UNKNOWN: Category = {
  label: "Service",
  type: "roundedRectangle",
  kind: "flow",
  style: { backgroundColor: "#e6e6e6", strokeColor: "#495057", fillStyle: "solid" },
  textColor: "#212529",
  keywords: [],
};

interface Detected {
  label: string;
  category: Category;
  index: number;
}

/** Find all known components in the text, in order of appearance. */
const detectComponents = (text: string): Detected[] => {
  const lower = text.toLowerCase();
  const out: Detected[] = [];
  const used: Array<{ label: string; index: number }> = [];
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      const i = lower.indexOf(kw);
      if (i >= 0) {
        const label = cat.label === "PostgreSQL" && /mysql|mongo|dynamodb/.test(lower) ? prettify(lower.slice(i)) : cat.label;
        if (!used.some((u) => Math.abs(u.index - i) < kw.length && u.label === label)) {
          used.push({ label, index: i });
          out.push({ label, category: cat, index: i });
        }
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
};

const prettify = (s: string) => {
  const words = s.trim().split(/[\s,.;:!?]+/).filter(Boolean);
  if (!words.length) return "Service";
  const mapped = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return mapped.slice(0, 4).join(" ");
};

/** Split "A → B → C" chains found in input. */
const detectExplicitChain = (text: string): string[] | null => {
  const parts = text.split(/[→➡→]/);
  if (parts.length < 2) return null;
  const items = parts.map((p) => p.trim()).filter(Boolean);
  if (items.length < 2) return null;
  return items.map((item) => {
    const det = detectComponents(item);
    return det.length ? det[det.length - 1].label : item.replace(/["']/g, "");
  });
};

const detectAuxClause = (text: string): boolean => {
  return /with\b|using\b|including\b|plus\b|and\b/.test(text.toLowerCase());
};

/** Build a vertical-flow DiagramSpec from detected components. */
const buildFlowSpec = (dets: Detected[], input: string): DiagramSpec => {
  const nodeH = 64;
  const nodeW = 180;
  const gap = 96;
  const nodes: DiagramNode[] = [];
  const edges: DiagramSpec["edges"] = [];

  const explicit = detectExplicitChain(input);

  let labels: Detected[] = dets;
  if (explicit && explicit.length >= 2) {
    // build from explicit chain, using detected styling per label if available
    labels = explicit.map((label) => {
      const found = CATEGORIES.find((c) => c.keywords.some((k) => label.toLowerCase().includes(k)));
      return {
        label,
        category: found ?? UNKNOWN,
        index: 0,
      };
    });
  }

  if (!labels.length) {
    return { nodes: [], edges: [] };
  }

  // decide aux split: last node if it's clearly an aux service and there are >=3 flow nodes
  const aux = detectAuxClause(input);
  const total = labels.length;
  let flowCount = total;
  let auxNodes: Detected[] = [];
  let flowNodes: Detected[] = labels;

  if (aux && total >= 3) {
    // treat nodes after the first flow node that are aux-category as auxiliary column
    const flowIds = new Set(labels.map((l) => l.category.kind).filter((k) => k === "flow").map((_, i) => i));
    void flowIds;
    const firstAuxIdx = labels.findIndex((l, i) => i > 0 && l.category.kind === "aux");
    if (firstAuxIdx > 0) {
      flowNodes = labels.slice(0, firstAuxIdx);
      auxNodes = labels.slice(firstAuxIdx);
      flowCount = flowNodes.length;
    }
  }

  let y = 0;
  const x = 0;
  const prevIds: string[] = [];
  for (let i = 0; i < flowNodes.length; i++) {
    const d = flowNodes[i];
    const id = uid();
    nodes.push({
      id,
      label: d.label,
      type: d.category.type,
      x,
      y,
      w: nodeW,
      h: nodeH,
      style: d.category.style,
      textStyle: { color: d.category.textColor, fontSize: 15, textBold: true },
    });
    if (i > 0) {
      edges.push({ from: prevIds[prevIds.length - 1], to: id });
    }
    prevIds.push(id);
    y += nodeH + gap;
  }

  // aux nodes to the right of the last flow node (staggered)
  if (auxNodes.length) {
    const auxX = x + nodeW + 140;
    const lastFlowY = (flowNodes.length - 1) * (nodeH + gap);
    for (let i = 0; i < auxNodes.length; i++) {
      const d = auxNodes[i];
      const id = uid();
      const ay = lastFlowY - (i - (auxNodes.length - 1) / 2) * (nodeH + 40);
      nodes.push({
        id,
        label: d.label,
        type: d.category.type,
        x: auxX,
        y: Math.max(0, ay),
        w: nodeW,
        h: nodeH,
        style: d.category.style,
        textStyle: { color: d.category.textColor, fontSize: 15, textBold: true },
      });
      const targetId = nodes[Math.min(i, flowCount - 1)].id;
      edges.push({ from: targetId, to: id });
    }
  }

  // normalize so the diagram starts near origin
  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  }
  const ox = -minX + 40;
  const oy = -minY + 40;
  for (const n of nodes) {
    n.x += ox;
    n.y += oy;
  }

  void flowCount;
  return { nodes, edges };
};

const normalizeLabel = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

const findElementByLabel = (els: Element[], query: string): Element | null => {
  const q = normalizeLabel(query);
  if (!q) return null;
  // text elements carry labels
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.type === "text") {
      const t = normalizeLabel((el as { text: string }).text);
      if (t.includes(q) || q.includes(t)) return el;
    }
  }
  // fall back to nearest match
  for (const el of els) {
    if (el.type === "text" && normalizeLabel((el as { text: string }).text) === q) return el;
  }
  return null;
};

/** Find the parent shape of a label (the shape the text overlaps). */
const parentShapeOf = (els: Element[], label: Element): Element | null => {
  const lc = {
    x: label.x + label.width / 2,
    y: label.y + label.height / 2,
  };
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.id === label.id || el.type === "text") continue;
    const b = elementBounds(el);
    if (lc.x >= b.minX && lc.x <= b.maxX && lc.y >= b.minY && lc.y <= b.maxY) {
      return el;
    }
  }
  return null;
};

const recolorElement = (el: Element, color: string): Element => {
  const c = colorNameToHex(color);
  return { ...el, backgroundColor: c.fill, strokeColor: c.stroke, fillStyle: "solid" };
};

const colorNameToHex = (color: string): { fill: string; stroke: string } => {
  const c = normalizeLabel(color);
  const map: Record<string, { fill: string; stroke: string }> = {
    blue: { fill: "#a5d8ff", stroke: "#1971c2" },
    red: { fill: "#ffc9c9", stroke: "#e03131" },
    green: { fill: "#b2f2bb", stroke: "#2b8a3e" },
    yellow: { fill: "#ffec99", stroke: "#f08c00" },
    orange: { fill: "#ffd8a8", stroke: "#e8590c" },
    purple: { fill: "#d0bfff", stroke: "#7048e8" },
    pink: { fill: "#ffc2e6", stroke: "#c2255c" },
    teal: { fill: "#99e9f2", stroke: "#0c8599" },
    gray: { fill: "#e6e6e6", stroke: "#495057" },
    grey: { fill: "#e6e6e6", stroke: "#495057" },
    white: { fill: "#ffffff", stroke: "#495057" },
    black: { fill: "#343a40", stroke: "#1e1e1e" },
  };
  if (c === "blue") return map.blue;
  if (c.includes("blue")) return map.blue;
  if (c.includes("red")) return map.red;
  if (c.includes("green")) return map.green;
  if (c.includes("yellow")) return map.yellow;
  if (c.includes("orange")) return map.orange;
  if (c.includes("purple")) return map.purple;
  if (c.includes("pink")) return map.pink;
  if (c.includes("teal")) return map.teal;
  if (c.includes("gray") || c.includes("grey")) return map.gray;
  if (c.includes("white")) return map.white;
  if (c.includes("black")) return map.black;
  return map.blue;
};

// ---------------------------------------------------------------------------

export const runAICommand = (input: string): AIResult => {
  const s = useStore.getState();
  const lower = input.toLowerCase().trim();
  const els = s.doc.elements;

  // --- EXPLAIN ---
  if (/explain|describe|what does this/.test(lower)) {
    const texts = els.filter((e) => e.type === "text").map((e) => (e as { text: string }).text.trim()).filter(Boolean);
    const shapes = els.filter((e) => e.type !== "text" && e.type !== "line" && e.type !== "arrow" && e.type !== "pencil");
    const arrows = els.filter((e) => e.type === "arrow");
    if (!texts.length) {
      return { ok: true, message: "The canvas is empty — there's nothing to explain yet." };
    }
    const explain = `I can see ${shapes.length} shape${shapes.length === 1 ? "" : "s"} and ${arrows.length} arrow${arrows.length === 1 ? "" : "s"}.\n\nKey components:\n${texts.map((t) => `• ${t}`).join("\n")}\n\nTip: connect shapes with arrows (A) to describe relationships, then ask me to explain again.`;
    return { ok: true, message: explain };
  }

  // --- MOVE ---
  const moveMatch = lower.match(/move\s+(?:the\s+)?([a-z0-9 _-]+?)\s+(?:to the\s+)?(left|right|up|down|top|bottom)/);
  if (moveMatch) {
    const target = findElementByLabel(els, moveMatch[1]);
    if (!target) {
      return { ok: false, message: `I couldn't find "${moveMatch[1].trim()}" on the canvas.` };
    }
    const shape = parentShapeOf(els, target) ?? target;
    const delta = { left: -260, right: 260, up: -140, down: 140, top: -260, bottom: 260 }[moveMatch[2]] ?? 0;
    const dx = moveMatch[2] === "left" || moveMatch[2] === "right" ? delta : 0;
    const dy = moveMatch[2] === "up" || moveMatch[2] === "down" || moveMatch[2] === "top" || moveMatch[2] === "bottom" ? Math.abs(delta) * (moveMatch[2] === "up" || moveMatch[2] === "top" ? -1 : 1) : 0;
    const id = shape.id;
    const next = els.map((e) => (e.id === id ? { ...e, x: e.x + dx, y: e.y + dy } : e));
    s.replaceElements(next);
    return { ok: true, message: `Moved "${moveMatch[1].trim()}" to the ${moveMatch[2]}.` };
  }

  // --- RECOLOR ---
  const recolorMatch = lower.match(/make\s+(?:the\s+)?([a-z0-9 _-]+?)\s+(section|service|node|box|part)?\s*(blue|red|green|yellow|orange|purple|pink|teal|gray|grey|white|black)/);
  if (recolorMatch) {
    const query = recolorMatch[1].trim();
    const color = recolorMatch[3];
    const targets = els.filter((e) => e.type === "text" && normalizeLabel((e as { text: string }).text).includes(query));
    const matched = targets.map((t) => parentShapeOf(els, t) ?? t);
    if (!matched.length) {
      return { ok: false, message: `I couldn't find "${query}" to recolor.` };
    }
    const ids = new Set(matched.map((m) => m.id));
    const next = els.map((e) => (ids.has(e.id) ? recolorElement(e, color) : e));
    s.replaceElements(next);
    return { ok: true, message: `Colored "${query}" ${color}.` };
  }

  // --- GROUP ---
  const groupMatch = lower.match(/group\s+(?:the\s+|together\s*)?(.*)/);
  if (groupMatch && /group/.test(lower)) {
    const query = groupMatch[1].replace(/services?|nodes?|components?/g, "").trim();
    const labels = els.filter((e) => e.type === "text");
    const targets = labels.filter((t) => query ? normalizeLabel((t as { text: string }).text).includes(query) : true);
    if (targets.length < 1) {
      return { ok: false, message: "I couldn't find elements to group." };
    }
    const shapes = targets.map((t) => parentShapeOf(els, t) ?? t);
    if (shapes.length === 1) {
      return { ok: false, message: "Grouping needs more than one element." };
    }
    const b = boundsFromElements(shapes);
    if (!b) return { ok: false, message: "Nothing to group." };
    const pad = 40;
    const container = {
      id: uid(),
      type: "roundedRectangle" as const,
      x: b.minX - pad,
      y: b.minY - pad - 20,
      width: b.maxX - b.minX + pad * 2,
      height: b.maxY - b.minY + pad * 2 + 20,
      angle: 0,
      seed: Math.floor(Math.random() * 2 ** 31),
      strokeColor: "#8a8a86",
      backgroundColor: "rgba(0,0,0,0)",
      fillStyle: "solid" as const,
      strokeWidth: 1.6,
      strokeStyle: "solid" as const,
      opacity: 0.7,
      roughness: 0.25,
      roundness: 0.5,
    };
    const groupLabel = makeText(container.x + 24, container.y + 10, groupMatch[1].trim() || "Group", {
      strokeColor: "#8a8a86",
      fillStyle: "solid",
    }, 13);
    groupLabel.textBold = false;
    groupLabel.width = (groupLabel.text.length + 2) * 8;
    groupLabel.height = 18;
    s.replaceElements([...els, container, groupLabel]);
    return { ok: true, message: `Grouped ${shapes.length} elements into "${groupMatch[1].trim() || "Group"}".` };
  }

  // --- ADD (node between / generic add) ---
  const addMatch = lower.match(/add\s+(?:a|an|the)?\s*([a-z0-9 _-]+?)\s+between\s+(?:the\s+)?([a-z0-9 _-]+?)\s+and\s+(?:the\s+)?([a-z0-9 _-]+)/);
  if (addMatch) {
    const [_, item, aName, bName] = addMatch;
    const a = findElementByLabel(els, aName);
    const b = findElementByLabel(els, bName);
    if (!a || !b) {
      return { ok: false, message: `I couldn't find both "${aName.trim()}" and "${bName.trim()}".` };
    }
    const aShape = parentShapeOf(els, a) ?? a;
    const bShape = parentShapeOf(els, b) ?? b;
    const ab = elementBounds(aShape);
    const bb = elementBounds(bShape);
    const midX = (ab.minX + ab.maxX + bb.minX + bb.maxX) / 4;
    const midY = (ab.minY + ab.maxY + bb.minY + bb.maxY) / 4;
    const category = CATEGORIES.find((c) => c.keywords.some((k) => item.includes(k))) ?? UNKNOWN;
    const label = category.label === "PostgreSQL" ? prettify(item) : category.label;
    const node: DiagramNode = {
      id: uid(),
      label,
      type: category.type,
      x: midX - 90,
      y: midY - 32,
      w: 180,
      h: 64,
      style: category.style,
      textStyle: { color: category.textColor, fontSize: 15, textBold: true },
    };
    const elements = specToElements({ nodes: [node], edges: [] });
    s.replaceElements([...els, ...elements]);
    return { ok: true, message: `Added "${label}" between ${aName.trim()} and ${bName.trim()}.` };
  }

  // --- GENERATE ---
  const genTrigger = /create|build|make|draw|generate|diagram|architecture|flowchart|wireframe|design/.test(lower);
  const dets = detectComponents(lower);
  if (genTrigger && dets.length) {
    const spec = buildFlowSpec(dets, input);
    if (!spec.nodes.length) {
      return { ok: false, message: "I understood you wanted a diagram, but couldn't identify any components. Try mentioning technologies like \"React Native\", \"API Gateway\", \"PostgreSQL\", \"Redis\", \"S3\"." };
    }
    const elements = specToElements(spec);
    return {
      ok: true,
      message: `Generated ${spec.nodes.length} components and ${spec.edges.length} connections.`,
      elements,
      replaceCanvas: true,
      explain: `Building ${spec.nodes.map((n) => n.label).join(" → ")}`,
    };
  }

  return {
    ok: false,
    message:
      "I didn't quite understand that. Try:\n\n• \"Create a payment system architecture\"\n• \"Add Redis between the API and database\"\n• \"Make the backend section blue\"\n• \"Group the authentication services\"\n• \"Move the database to the right\"\n• \"Explain this architecture\"",
  };
};

export const AI_SUGGESTIONS = [
  "Create a system architecture for a React Native app with AWS authentication, PostgreSQL, Redis and S3",
  "Create a payment system architecture",
  "Add Redis between the API and database",
  "Make the backend section blue",
  "Group the authentication services",
  "Move the database to the right",
  "Explain this architecture",
];