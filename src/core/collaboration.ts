import { create } from "zustand";
import type { Document } from "../types";
import { useStore } from "./store";
import {
  sync,
  createWebSocketBackend,
  type CollabPeer,
  type SyncStatus,
} from "./sync";

const NAME_KEY = "whiteboard:collab:name";
const CLIENT_KEY = "whiteboard:collab:clientId";

/** stable per-peer accent color derived from the client id */
const CURSOR_COLORS = [
  "#e03131",
  "#f08c00",
  "#2f9e44",
  "#1971c2",
  "#9c36b5",
  "#0c8599",
  "#e8590c",
  "#5f3dc4",
];

const colorFor = (clientId: string): string => {
  let h = 0;
  for (let i = 0; i < clientId.length; i++) {
    h = (h * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[h % CURSOR_COLORS.length];
};

export const getClientId = (): string => {
  let id: string | null = null;
  try {
    id = localStorage.getItem(CLIENT_KEY);
  } catch {
    /* ignore */
  }
  if (!id) {
    id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(CLIENT_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
};

const defaultName = () =>
  `User-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * Candidate WebSocket URLs for the collaboration relay, best first.
 * Override with VITE_WS_URL (build-time). In production the relay shares the
 * app's origin (server/prod.mjs), so same-origin is tried first — that's how
 * Render deploys, where all public traffic lands on one port. The dedicated
 * `:8787` port is kept as a fallback for other setups.
 */
export const getWsUrls = (): string[] => {
  const envUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  if (envUrl) return [envUrl];
  if (import.meta.env.PROD) {
    return [
      `${proto}//${location.host}`,
      `${proto}//${location.hostname}:8787`,
    ];
  }
  // Dev: Vite serves the app; the relay runs separately on 8787.
  return [`${proto}//${location.hostname}:8787`];
};

export interface CursorEntry {
  name: string;
  x: number;
  y: number;
  color: string;
  lastSeen: number;
}

interface CollabState {
  roomId: string | null;
  status: SyncStatus;
  peers: CollabPeer[];
  name: string;
  error: string | null;
  /** remote collaborators' live cursors, keyed by clientId */
  cursors: Record<string, CursorEntry>;
  connect: (roomId: string) => void;
  disconnect: () => void;
  setName: (name: string) => void;
  inviteUrl: () => string;
  /** broadcast our pointer position (world coords), throttled */
  publishCursor: (x: number, y: number) => void;
}

let pendingRemote: Document | null = null;

// cursor broadcast throttling — send at most every CURSOR_MS, with a
// trailing send so the last known position always reaches peers.
const CURSOR_MS = 50;
const CURSOR_STALE_MS = 3000;
let lastSentCursor = 0;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCursor: { x: number; y: number } | null = null;

const applyRemote = (doc: Document) => {
  const s = useStore.getState();
  // don't clobber an in-flight gesture (shape being dragged / pencil stroke)
  if (s.previewing) {
    pendingRemote = doc;
    return;
  }
  pendingRemote = null;
  useStore.getState().resetFromDocument(doc);
};

export const useCollab = create<CollabState>()((set, get) => {
  let name = "Guest";
  try {
    name = localStorage.getItem(NAME_KEY) || defaultName();
  } catch {
    name = defaultName();
  }

  return {
    roomId: null,
    status: "local",
    peers: [],
    name,
    error: null,
    cursors: {},

    connect: (roomId) => {
      const id = roomId.trim().toLowerCase();
      if (!id) return;
      if (get().status === "connected" && get().roomId === id) return;

      set({ roomId: id, error: null, cursors: {} });
      const backend = createWebSocketBackend(getWsUrls(), getClientId(), get().name);
      sync.attach(backend);

      backend.connect(id, {
        onRoomDoc: (doc) => {
          const s = useStore.getState();
          if (doc && Array.isArray(doc.elements) && doc.elements.length) {
            // room is authoritative for newcomers
            applyRemote(doc);
          } else if (!doc && s.doc.elements.length) {
            // empty room — seed it with our current canvas
            backend.publish(s.doc);
          }
        },
        onRemoteChange: (doc) => applyRemote(doc),
        onPeersChange: (peers) => {
          set((s) => {
            const keep = new Set(peers.map((p) => p.clientId));
            const cursors = Object.fromEntries(
              Object.entries(s.cursors).filter(([id]) => keep.has(id)),
            );
            return { peers, cursors };
          });
        },
        onCursor: (cursor) => {
          if (cursor.clientId === getClientId()) return;
          set((s) => ({
            cursors: {
              ...s.cursors,
              [cursor.clientId]: {
                name: cursor.name,
                x: cursor.x,
                y: cursor.y,
                color: colorFor(cursor.clientId),
                lastSeen: Date.now(),
              },
            },
          }));
        },
        onStatusChange: (status) => set({ status }),
        onError: (message) => set({ error: message }),
      });
    },

    disconnect: () => {
      sync.detach();
      set({ roomId: null, status: "local", peers: [], error: null, cursors: {} });
    },

    publishCursor: (x, y) => {
      if (get().status !== "connected") return;
      pendingCursor = { x, y };
      const now = Date.now();
      if (now - lastSentCursor >= CURSOR_MS) {
        lastSentCursor = now;
        flushCursor();
      } else if (!cursorTimer) {
        cursorTimer = setTimeout(() => {
          cursorTimer = null;
          lastSentCursor = Date.now();
          flushCursor();
        }, CURSOR_MS);
      }
    },

    setName: (raw) => {
      const n = raw.trim().slice(0, 24) || "Guest";
      set({ name: n });
      try {
        localStorage.setItem(NAME_KEY, n);
      } catch {
        /* ignore */
      }
      // re-join so the new name reaches the server
      const roomId = get().roomId;
      if (roomId && (get().status === "connected" || get().status === "connecting")) {
        sync.detach();
        get().connect(roomId);
      }
    },

    inviteUrl: () => {
      const { roomId } = get();
      if (!roomId) return "";
      const url = new URL(location.href);
      url.searchParams.set("room", roomId);
      return url.toString();
    },
  };
});

/** Apply remote docs that arrived while a gesture was in flight. */
useStore.subscribe((s) => {
  if (!s.previewing && pendingRemote) {
    const doc = pendingRemote;
    pendingRemote = null;
    applyRemote(doc);
  }
});

const flushCursor = () => {
  if (!pendingCursor) return;
  const { x, y } = pendingCursor;
  pendingCursor = null;
  sync.backend?.publishCursor(x, y);
};

/** drop cursors from peers that went idle or disconnected */
const pruneStaleCursors = () => {
  useCollab.setState((s) => {
    if (!Object.keys(s.cursors).length) return s;
    const now = Date.now();
    const cursors = Object.fromEntries(
      Object.entries(s.cursors).filter(([, c]) => now - c.lastSeen < CURSOR_STALE_MS),
    );
    return Object.keys(cursors).length === Object.keys(s.cursors).length
      ? s
      : { cursors };
  });
};

/** Join a room encoded in the URL (?room=...) when the app boots. */
export const initCollaboration = () => {
  setInterval(pruneStaleCursors, 1000);
  try {
    const room = new URLSearchParams(location.search).get("room");
    if (room) useCollab.getState().connect(room);
  } catch {
    /* ignore */
  }
};