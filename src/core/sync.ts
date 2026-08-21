import type { Document } from "../types";

/**
 * Real-time collaboration synchronization layer.
 *
 * `SyncLayer` is the single seam between the app and multiplayer transport.
 * The store already calls `sync.publish(doc)` after every committed change, so
 * a backend only has to push the document to peers and hand remote documents
 * back through `onRemoteChange`. A `WebSocketBackend` that talks to
 * `server/index.mjs` is included; swap in a CRDT / WebRTC backend without
 * touching the rest of the app.
 */

export type SyncStatus = "local" | "connecting" | "connected" | "disconnected";

export interface CollabPeer {
  clientId: string;
  name: string;
}

export interface RemoteCursor {
  clientId: string;
  name: string;
  /** world coordinates on the shared canvas */
  x: number;
  y: number;
}

export interface SyncCallbacks {
  /** a peer published a new document state */
  onRemoteChange: (doc: Document) => void;
  /** the room's authoritative document, delivered on (re)connect */
  onRoomDoc: (doc: Document | null) => void;
  /** the current list of peers in the room (excluding self) */
  onPeersChange: (peers: CollabPeer[]) => void;
  /** a peer moved their cursor */
  onCursor?: (cursor: RemoteCursor) => void;
  onStatusChange: (status: SyncStatus) => void;
  onError?: (message: string) => void;
}

export interface SyncBackend {
  connect(roomId: string, callbacks: SyncCallbacks): void;
  publish(doc: Document): void;
  /** broadcast our pointer position (world coordinates) */
  publishCursor(x: number, y: number): void;
  disconnect(): void;
  status: SyncStatus;
}

export interface SyncLayer {
  backend: SyncBackend | null;
  /** attach a backend and take over transport for all future publishes */
  attach(backend: SyncBackend): void;
  /** detach the current backend (local-only again) */
  detach(): void;
  /** notify remote peers about a committed change */
  publish(doc: Document): void;
}

class LocalSync implements SyncLayer {
  backend: SyncBackend | null = null;
  attach(backend: SyncBackend) {
    this.backend?.disconnect();
    this.backend = backend;
  }
  detach() {
    this.backend?.disconnect();
    this.backend = null;
  }
  publish(doc: Document) {
    this.backend?.publish(doc);
  }
}

export const sync: SyncLayer = new LocalSync();

/**
 * WebSocket backend for the bundled relay server (server/index.mjs).
 * Uses the native browser WebSocket, reconnects with exponential backoff,
 * and reports presence + connection status to the collaboration UI.
 */
export const createWebSocketBackend = (
  urls: string[],
  clientId: string,
  name: string,
): SyncBackend => {
  return new WebSocketBackend(urls, clientId, name);
};

class WebSocketBackend implements SyncBackend {
  status: SyncStatus = "local";

  private ws: WebSocket | null = null;
  private roomId = "";
  private callbacks: SyncCallbacks | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private urls: string[];
  private urlIndex = 0;
  private hasConnected = false;
  private clientId: string;
  private name: string;

  constructor(urls: string[], clientId: string, name: string) {
    this.urls = urls;
    this.clientId = clientId;
    this.name = name;
  }

  connect(roomId: string, callbacks: SyncCallbacks) {
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.closedByUser = false;
    this.reconnectAttempts = 0;
    this.urlIndex = 0;
    this.hasConnected = false;
    this.open();
  }

  publish(doc: Document) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "doc", doc }));
    }
  }

  publishCursor(x: number, y: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "cursor", x, y }));
    }
  }

  disconnect() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.callbacks = null;
    this.setStatus("local");
  }

  private open() {
    this.setStatus("connecting");

    const url = this.urls[this.urlIndex % this.urls.length];

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.hasConnected = true;
      this.urlIndex = 0;
      this.reconnectAttempts = 0;
      ws.send(
        JSON.stringify({
          type: "join",
          room: this.roomId,
          clientId: this.clientId,
          name: this.name,
        }),
      );
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      const cb = this.callbacks;
      if (!cb) return;

      switch (msg.type) {
        case "welcome":
          this.setStatus("connected");
          cb.onRoomDoc((msg.doc as Document | null) ?? null);
          cb.onPeersChange((msg.peers as CollabPeer[] | undefined) ?? []);
          break;
        case "peers":
          cb.onPeersChange((msg.peers as CollabPeer[] | undefined) ?? []);
          break;
        case "doc":
          if (msg.doc && typeof msg.doc === "object") {
            cb.onRemoteChange(msg.doc as Document);
          }
          break;
        case "cursor":
          if (
            typeof msg.clientId === "string" &&
            typeof msg.x === "number" &&
            typeof msg.y === "number"
          ) {
            cb.onCursor?.({
              clientId: msg.clientId,
              name: typeof msg.name === "string" ? msg.name : "Guest",
              x: msg.x,
              y: msg.y,
            });
          }
          break;
        case "error":
          cb.onError?.(String(msg.message ?? "Unknown server error"));
          break;
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.closedByUser) return;
      // Never reached the relay on this candidate — try the next URL before
      // falling back to the regular exponential-backoff reconnect.
      if (!this.hasConnected && this.urlIndex + 1 < this.urls.length) {
        this.urlIndex += 1;
        this.reconnectAttempts = 0;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (!this.closedByUser) this.open();
        }, 500);
        return;
      }
      this.setStatus("disconnected");
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      /* onclose handles teardown */
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.closedByUser) return;
    const delay = Math.min(2000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByUser) this.open();
    }, delay);
  }

  private setStatus(status: SyncStatus) {
    if (this.status === status) return;
    this.status = status;
    this.callbacks?.onStatusChange(status);
  }
}