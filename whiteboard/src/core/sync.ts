import type { Document } from "../types";

/**
 * Collaboration-ready synchronization abstraction.
 *
 * Currently a local-only implementation. To add realtime multiplayer later,
 * provide a SyncBackend that pushes/pulls documents over WebSocket/WebRTC/CRDT
 * without changing anything else in the app.
 */
export interface SyncBackend {
  connect(roomId: string, onRemoteChange: (doc: Document) => void): void;
  publish(doc: Document): void;
  disconnect(): void;
  status: "local" | "connecting" | "connected" | "disconnected";
}

export interface SyncLayer {
  backend: SyncBackend | null;
  /** attach a backend (e.g. on first "Share" click) */
  attach(backend: SyncBackend): void;
  /** notify remote peers about a committed change */
  publish(doc: Document): void;
}

class LocalSync implements SyncLayer {
  backend: SyncBackend | null = null;
  attach(backend: SyncBackend) {
    this.backend?.disconnect();
    this.backend = backend;
  }
  publish(doc: Document) {
    this.backend?.publish(doc);
  }
}

export const sync: SyncLayer = new LocalSync();

/** Example backend factory — placeholder for a real WebSocket transport. */
export const createWebSocketBackend = (_url: string): SyncBackend => {
  // Intentionally minimal: wire this up to your server when ready.
  return {
    connect: (_roomId: string) => {},
    publish: (_doc: Document) => {},
    disconnect: () => {},
    status: "local",
  };
};