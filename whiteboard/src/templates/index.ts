import type { Element, ElementStyle } from "../types";
import { specToElements, type DiagramNode, type DiagramSpec } from "../ai/diagram";
import { makeRoundedRectangle, makeText } from "../core/elements";
import { uid } from "../util/id";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  build: () => Element[];
}

const S = {
  blue: { backgroundColor: "#a5d8ff", strokeColor: "#1864ab", fillStyle: "solid" as const },
  green: { backgroundColor: "#b2f2bb", strokeColor: "#2b8a3e", fillStyle: "solid" as const },
  yellow: { backgroundColor: "#ffec99", strokeColor: "#e8590c", fillStyle: "solid" as const },
  orange: { backgroundColor: "#ffd8a8", strokeColor: "#e8590c", fillStyle: "solid" as const },
  purple: { backgroundColor: "#d0bfff", strokeColor: "#5f3dc4", fillStyle: "solid" as const },
  pink: { backgroundColor: "#ffc2e6", strokeColor: "#a61e4d", fillStyle: "solid" as const },
  teal: { backgroundColor: "#99e9f2", strokeColor: "#0c8599", fillStyle: "solid" as const },
  gray: { backgroundColor: "#e6e6e6", strokeColor: "#495057", fillStyle: "solid" as const },
  white: { backgroundColor: "#ffffff", strokeColor: "#495057", fillStyle: "solid" as const },
};

const node = (label: string, x: number, y: number, style: Partial<ElementStyle>, w = 170, h = 60, type: DiagramNode["type"] = "roundedRectangle"): DiagramNode => ({
  id: uid(),
  label,
  type,
  x,
  y,
  w,
  h,
  style,
  textStyle: { fontSize: 14, textBold: true, color: style.strokeColor as string },
});

const edge = (from: string, to: string): DiagramSpec["edges"][number] => ({ from, to });

const awsArchitecture = (): Element[] => {
  const ns: DiagramNode[] = [];
  const es: DiagramSpec["edges"] = [];
  const n = (label: string, x: number, y: number, st: Partial<ElementStyle>, w = 170, h = 60) => {
    const d = node(label, x, y, st, w, h);
    ns.push(d);
    return d;
  };
  const mobile = n("Mobile App", 40, 30, S.blue);
  const cloudfront = n("CloudFront\nCDN", 300, 30, S.purple);
  const alb = n("ALB\nLoad Balancer", 560, 30, S.yellow);
  const api = n("API Gateway", 820, 30, S.purple, 170, 70);
  const auth = n("Cognito\nAuth", 300, 180, S.orange);
  const backend = n("EC2\nBackend", 560, 180, S.gray, 170, 70);
  const lambda = n("Lambda\nWorkers", 820, 180, S.gray, 170, 70);
  const rds = n("RDS\nPostgreSQL", 560, 340, S.teal, 170, 70);
  const redis = n("ElastiCache\nRedis", 820, 340, S.pink, 170, 70);
  const s3 = n("S3 Storage", 1100, 340, S.green, 170, 70);
  const iam = n("IAM Roles", 1100, 180, S.orange, 150, 60);

  es.push(edge(mobile.id, cloudfront.id), edge(cloudfront.id, alb.id), edge(alb.id, api.id));
  es.push(edge(mobile.id, auth.id), edge(api.id, auth.id));
  es.push(edge(api.id, backend.id), edge(api.id, lambda.id));
  es.push(edge(backend.id, rds.id), edge(backend.id, redis.id), edge(backend.id, s3.id));
  es.push(edge(lambda.id, s3.id), edge(auth.id, iam.id));
  return specToElements({ nodes: ns, edges: es });
};

const systemArchitecture = (): Element[] => {
  const ns: DiagramNode[] = [];
  const es: DiagramSpec["edges"] = [];
  const n = (label: string, x: number, y: number, st: Partial<ElementStyle>, w = 170, h = 60) => {
    const d = node(label, x, y, st, w, h);
    ns.push(d);
    return d;
  };
  const ui = n("Web UI", 40, 40, S.blue);
  const spa = n("SPA\n(React)", 40, 170, S.blue);
  const gateway = n("API Gateway", 300, 40, S.purple);
  const auth = n("Auth Service", 300, 170, S.orange);
  const core = n("Core Backend", 560, 40, S.gray, 170, 70);
  const search = n("Search Service", 560, 170, S.yellow);
  const queue = n("Message Queue", 820, 40, S.pink);
  const worker = n("Worker", 820, 170, S.gray);
  const db = n("PostgreSQL", 560, 320, S.teal);
  const redis = n("Redis", 820, 320, S.pink);
  const es2 = n("Elasticsearch", 1100, 320, S.yellow);

  es.push(edge(ui.id, spa.id), edge(spa.id, gateway.id), edge(ui.id, gateway.id));
  es.push(edge(gateway.id, core.id), edge(gateway.id, auth.id));
  es.push(edge(core.id, search.id), edge(core.id, queue.id), edge(queue.id, worker.id));
  es.push(edge(core.id, db.id), edge(core.id, redis.id), edge(core.id, es2.id));
  es.push(edge(worker.id, db.id));
  return specToElements({ nodes: ns, edges: es });
};

const erDiagram = (): Element[] => {
  const ns: DiagramNode[] = [];
  const es: DiagramSpec["edges"] = [];
  const n = (label: string, x: number, y: number, st: Partial<ElementStyle>) => {
    const d = node(label, x, y, st, 180, 80, "rectangle");
    ns.push(d);
    return d;
  };
  const users = n("USERS\nid PK\nname\nemail", 40, 40, S.blue);
  const orders = n("ORDERS\nid PK\nuser_id FK\namount\nstatus", 320, 40, S.teal);
  const products = n("PRODUCTS\nid PK\nsku\nprice", 600, 40, S.green);
  const orderItems = n("ORDER_ITEMS\nid PK\norder_id FK\nproduct_id FK\nqty", 460, 220, S.yellow);
  const payments = n("PAYMENTS\nid PK\norder_id FK\nmethod\npaid_at", 320, 400, S.purple);

  es.push({ from: users.id, to: orders.id, label: "1 — N" });
  es.push({ from: orders.id, to: orderItems.id, label: "1 — N" });
  es.push({ from: products.id, to: orderItems.id, label: "1 — N" });
  es.push({ from: orders.id, to: payments.id, label: "1 — N" });
  return specToElements({ nodes: ns, edges: es });
};

const flowchart = (): Element[] => {
  const ns: DiagramNode[] = [];
  const es: DiagramSpec["edges"] = [];
  const n = (label: string, x: number, y: number, st: Partial<ElementStyle>, type: DiagramNode["type"] = "rectangle", w = 160, h = 56) => {
    const d = node(label, x, y, st, w, h, type);
    ns.push(d);
    return d;
  };
  const start = n("Start", 60, 20, S.green, "ellipse", 130, 50);
  const check = n("User logged in?", 60, 150, S.blue, "diamond", 170, 90);
  const login = n("Show login", 300, 150, S.yellow, "rectangle", 150, 56);
  const dashboard = n("Load dashboard", 60, 300, S.teal);
  const fetch = n("Fetch data", 300, 300, S.purple);
  const error = n("Show error", 300, 430, S.pink);
  const done = n("Done", 60, 450, S.green, "ellipse", 130, 50);

  es.push(edge(start.id, check.id));
  es.push(edge(check.id, login.id));
  es.push(edge(login.id, dashboard.id));
  es.push(edge(check.id, dashboard.id));
  es.push(edge(dashboard.id, fetch.id));
  es.push(edge(fetch.id, error.id));
  es.push(edge(fetch.id, done.id));
  return specToElements({ nodes: ns, edges: es });
};

const mindMap = (): Element[] => {
  const ns: DiagramNode[] = [];
  const es: DiagramSpec["edges"] = [];
  const n = (label: string, x: number, y: number, st: Partial<ElementStyle>, w = 130, h = 50) => {
    const d = node(label, x, y, st, w, h, "ellipse");
    ns.push(d);
    return d;
  };
  const root = n("Whiteboard", 300, 260, S.purple, 150, 60);
  const b1 = n("Canvas", 40, 120, S.blue);
  const b2 = n("Shapes", 40, 280, S.green);
  const b3 = n("Text", 40, 440, S.yellow);
  const b4 = n("Export", 560, 120, S.orange);
  const b5 = n("Collaborate", 560, 280, S.teal);
  const b6 = n("AI", 560, 440, S.pink);
  const leaf = n("Undo/Redo", 560, 560, S.gray);

  es.push(edge(root.id, b1.id), edge(root.id, b2.id), edge(root.id, b3.id));
  es.push(edge(root.id, b4.id), edge(root.id, b5.id), edge(root.id, b6.id));
  es.push(edge(b5.id, leaf.id));
  return specToElements({ nodes: ns, edges: es });
};

const wireframe = (): Element[] => {
  const els: Element[] = [];
  const x = 40;
  const y = 40;
  const frame = makeRoundedRectangle(x, y, 320, 620, { strokeColor: "#495057", strokeWidth: 2, fillStyle: "solid", backgroundColor: "#ffffff", roughness: 0.2 });
  frame.id = uid();
  els.push(frame);
  // status bar
  const status = makeRoundedRectangle(x + 16, y + 16, 288, 28, { strokeColor: "#adb5bd", strokeWidth: 1.4, fillStyle: "solid", backgroundColor: "transparent", roughness: 0.2 });
  status.id = uid();
  els.push(status);
  // header
  const header = makeRoundedRectangle(x + 16, y + 60, 288, 44, { strokeColor: "#868e96", strokeWidth: 1.4, fillStyle: "solid", backgroundColor: "#f1f3f5", roughness: 0.2 });
  header.id = uid();
  els.push(header);
  const search = makeRoundedRectangle(x + 28, y + 72, 120, 20, { strokeColor: "#ced4da", strokeWidth: 1.2, fillStyle: "solid", backgroundColor: "#ffffff", roughness: 0.2 });
  search.id = uid();
  els.push(search);
  // hero banner
  const hero = makeRoundedRectangle(x + 16, y + 120, 288, 120, { strokeColor: "#868e96", strokeWidth: 1.4, fillStyle: "solid", backgroundColor: "#e9ecef", roughness: 0.2 });
  hero.id = uid();
  els.push(hero);
  // image placeholder
  const img = makeRoundedRectangle(x + 40, y + 140, 240, 80, { strokeColor: "#adb5bd", strokeWidth: 1.4, fillStyle: "solid", backgroundColor: "#dee2e6", roughness: 0.2 });
  img.id = uid();
  els.push(img);
  // row list
  for (let i = 0; i < 3; i++) {
    const row = makeRoundedRectangle(x + 16, y + 270 + i * 46, 288, 36, { strokeColor: "#adb5bd", strokeWidth: 1.4, fillStyle: "solid", backgroundColor: "#f8f9fa", roughness: 0.2 });
    row.id = uid();
    els.push(row);
    const thumb = makeRoundedRectangle(x + 28, y + 282 + i * 46, 40, 24, { strokeColor: "#ced4da", strokeWidth: 1.2, fillStyle: "solid", backgroundColor: "#e9ecef", roughness: 0.2 });
    thumb.id = uid();
    els.push(thumb);
  }
  // nav bar
  const nav = makeRoundedRectangle(x + 16, y + 560, 288, 44, { strokeColor: "#868e96", strokeWidth: 1.4, fillStyle: "solid", backgroundColor: "#f1f3f5", roughness: 0.2 });
  nav.id = uid();
  els.push(nav);
  const home = makeRoundedRectangle(x + 28, y + 568, 24, 28, { strokeColor: "#adb5bd", strokeWidth: 1.2, fillStyle: "solid", backgroundColor: "#dee2e6", roughness: 0.2 });
  home.id = uid();
  els.push(home);
  const home2 = makeRoundedRectangle(x + 72, y + 568, 24, 28, { strokeColor: "#adb5bd", strokeWidth: 1.2, fillStyle: "solid", backgroundColor: "#dee2e6", roughness: 0.2 });
  home2.id = uid();
  els.push(home2);
  const home3 = makeRoundedRectangle(x + 116, y + 568, 24, 28, { strokeColor: "#adb5bd", strokeWidth: 1.2, fillStyle: "solid", backgroundColor: "#dee2e6", roughness: 0.2 });
  home3.id = uid();
  els.push(home3);
  const labels = ["Home Screen", "Search products", "Recent orders", "Cart & Checkout"];
  const pos = [[x + 40, y + 28], [x + 40, y + 74], [x + 40, y + 412], [x + 40, y + 610]];
  labels.forEach((l, i) => {
    const t = makeText(pos[i][0], pos[i][1], l, { strokeColor: "#343a40", fillStyle: "solid" }, 14);
    t.textBold = false;
    t.width = l.length * 8;
    t.height = 20;
    els.push(t);
  });
  return els;
};

const businessProcess = (): Element[] => {
  const ns: DiagramNode[] = [];
  const es: DiagramSpec["edges"] = [];
  const n = (label: string, x: number, y: number, st: Partial<ElementStyle>, type: DiagramNode["type"] = "roundedRectangle", w = 160, h = 56) => {
    const d = node(label, x, y, st, w, h, type);
    ns.push(d);
    return d;
  };
  const start = n("Request received", 40, 40, S.green, "ellipse", 150, 50);
  const validate = n("Validate input", 280, 40, S.blue, "diamond", 170, 90);
  const reject = n("Send rejection", 520, 20, S.pink, "rectangle", 150, 56);
  const approve = n("Approve & assign", 520, 160, S.yellow);
  const notify = n("Notify owner", 280, 200, S.purple);
  const fulfill = n("Fulfill request", 280, 330, S.teal);
  const review = n("Review & close", 520, 330, S.gray);
  const end = n("Done", 280, 460, S.green, "ellipse", 130, 50);

  es.push(edge(start.id, validate.id));
  es.push(edge(validate.id, reject.id));
  es.push(edge(validate.id, approve.id));
  es.push(edge(approve.id, notify.id));
  es.push(edge(notify.id, fulfill.id));
  es.push(edge(fulfill.id, review.id));
  es.push(edge(review.id, end.id));
  return specToElements({ nodes: ns, edges: es });
};

export const templates: Template[] = [
  { id: "aws", name: "AWS Architecture", description: "Cloud infrastructure with CDN, load balancing, compute, database and storage.", category: "Architecture", build: awsArchitecture },
  { id: "system", name: "System Architecture", description: "Layered web application with gateway, services, queue and data stores.", category: "Architecture", build: systemArchitecture },
  { id: "er", name: "Database ER Diagram", description: "Entities, relationships and keys.", category: "Database", build: erDiagram },
  { id: "flowchart", name: "Flowchart", description: "Start / decision / action flow.", category: "Flow", build: flowchart },
  { id: "mindmap", name: "Mind Map", description: "Radial brainstorming map.", category: "Thinking", build: mindMap },
  { id: "wireframe", name: "Mobile App Wireframe", description: "Phone screen layout placeholder.", category: "Wireframe", build: wireframe },
  { id: "bpm", name: "Business Process", description: "Request-to-close process flow.", category: "Process", build: businessProcess },
];