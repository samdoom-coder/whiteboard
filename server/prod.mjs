/**
 * Whiteboard production server.
 *
 * Serves the built frontend (dist/) and hosts the realtime collaboration
 * relay — all on a single port (default 8787). The frontend connects to the
 * relay at ws://<same host>:<same port>, so no extra config is needed.
 *
 * Run with:  npm start   (or: node server/prod.mjs)
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRelay } from "./index.mjs";

const PORT = Number(process.env.PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

const readHtml = () =>
  new Promise((resolve) => {
    fs.readFile(path.join(DIST, "index.html"), (err, data) =>
      resolve(err ? null : data),
    );
  });

const server = http.createServer(async (req, res) => {
  let pathname = req.url || "/";
  try {
    pathname = decodeURIComponent(pathname.split("?")[0]);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.normalize(path.join(DIST, pathname));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    const target = !statErr && stat.isDirectory()
      ? path.join(filePath, "index.html")
      : filePath;

    fs.readFile(target, async (readErr, data) => {
      if (readErr) {
        // SPA fallback: hand unknown routes to the app shell.
        const html = await readHtml();
        if (html) {
          res.writeHead(200, { "Content-Type": MIME[".html"] });
          res.end(html);
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });
});

createRelay(server);

server.listen(PORT, () => {
  console.log(`[whiteboard] serving http://0.0.0.0:${PORT} (app + relay)`);
});
