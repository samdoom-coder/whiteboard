/**
 * Whiteboard realtime collaboration relay.
 *
 * A tiny WebSocket server that brokers documents and presence between
 * peers in shared rooms. The server keeps only the latest document per
 * room so late joiners can pick up the current state. It never persists
 * anything and forgets a room once the last peer leaves.
 *
 * Run with:  npm run server   (or: node server/index.mjs)
 */
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const HEARTBEAT_MS = 30000;
const MAX_PAYLOAD = 50 * 1024 * 1024; // 50 MiB (embedded images can be large)

const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_PAYLOAD });

/** roomId -> { doc: Document | null, clients: Set<WebSocket> } */
const rooms = new Map();

const sanitizeRoom = (v) =>
  typeof v === "string"
    ? v.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
    : "";
const sanitizeName = (v) =>
  (typeof v === "string" ? v.trim() : "").slice(0, 24) || "Guest";
const sanitizeClientId = (v) =>
  (typeof v === "string" ? v.trim() : "").slice(0, 64);

const send = (ws, msg) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

const broadcast = (room, sender, msg) => {
  const data = JSON.stringify(msg);
  for (const c of room.clients) {
    if (c !== sender && c.readyState === c.OPEN) c.send(data);
  }
};

const peersOf = (room) =>
  [...room.clients]
    .map((c) => ({ clientId: c.clientId, name: c.name }))
    .filter((p) => p.clientId);

const pushPeers = (room) => {
  const peers = peersOf(room);
  for (const c of room.clients) {
    if (c.readyState === c.OPEN) send(c, { type: "peers", peers });
  }
};

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.roomId = null;
  ws.clientId = "";
  ws.name = "Guest";

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "join") {
      const roomId = sanitizeRoom(msg.room);
      if (!roomId) return;

      ws.roomId = roomId;
      ws.clientId = sanitizeClientId(msg.clientId);
      ws.name = sanitizeName(msg.name);

      let room = rooms.get(roomId);
      if (!room) {
        room = { doc: null, clients: new Set() };
        rooms.set(roomId, room);
      }
      room.clients.add(ws);

      send(ws, { type: "welcome", doc: room.doc, peers: peersOf(room) });
      pushPeers(room);
      return;
    }

    if (msg.type === "doc") {
      if (!ws.roomId) return;
      const room = rooms.get(ws.roomId);
      if (!room) return;
      const doc = msg.doc;
      if (!doc || typeof doc !== "object" || !Array.isArray(doc.elements)) return;
      room.doc = doc;
      broadcast(room, ws, { type: "doc", doc });
      return;
    }

    if (msg.type === "cursor") {
      if (!ws.roomId) return;
      const room = rooms.get(ws.roomId);
      if (!room) return;
      const x = Number(msg.x);
      const y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      broadcast(room, ws, {
        type: "cursor",
        clientId: ws.clientId,
        name: ws.name,
        x,
        y,
      });
      return;
    }
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.clients.delete(ws);
    if (room.clients.size) {
      pushPeers(room);
    } else {
      rooms.delete(ws.roomId);
    }
  });

  ws.on("error", () => {
    /* close handler cleans up */
  });
});

// keep connections alive and reap dead peers
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

console.log(`[whiteboard] collaboration relay listening on ws://0.0.0.0:${PORT}`);