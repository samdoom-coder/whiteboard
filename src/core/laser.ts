/**
 * Ephemeral laser-pointer trails.
 *
 * Trails live outside the document/undo history on purpose: they are a
 * presentation aid, never persisted, and they fade away on their own.
 * Local trails stay on this client; remote trails arrive over the
 * collaboration relay and are rendered in the peer's color. The canvas
 * engine reads this module every frame and renders everything with a
 * glow + tail-first fade.
 */

export interface LaserPoint {
  x: number;
  y: number;
  /** when this point was drawn (ms epoch) — drives the tail-first fade */
  t: number;
}

export interface LaserTrail {
  id: number;
  points: LaserPoint[]; // world coords, oldest first
  /** last time a point was appended (ms epoch) */
  updatedAt: number;
  /** stroke color; defaults to laser red for local trails */
  color?: string;
}

/** Stable per-peer accent color derived from the client id. */
const PEER_COLORS = [
  "#e03131",
  "#f08c00",
  "#2f9e44",
  "#1971c2",
  "#9c36b5",
  "#0c8599",
  "#e8590c",
  "#5f3dc4",
];

export const peerColor = (clientId: string): string => {
  let h = 0;
  for (let i = 0; i < clientId.length; i++) {
    h = (h * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  return PEER_COLORS[h % PEER_COLORS.length];
};

export const LASER_FADE_MS = 2000;

interface RemoteTrail extends LaserTrail {
  clientId: string;
}

let trails: LaserTrail[] = [];
let remoteTrails: RemoteTrail[] = [];
/** peers with a stroke currently in progress */
const remoteOpen = new Set<string>();
let activeId: number | null = null;
let nextId = 1;

let cursor: { x: number; y: number; visible: boolean; updatedAt: number } = {
  x: 0,
  y: 0,
  visible: false,
  updatedAt: 0,
};

const MIN_DIST_SQ = 2.5 * 2.5;

const pruneList = <T extends LaserTrail>(list: T[], now: number): T[] => {
  for (const t of list) {
    // drop faded points from the head of the trail so it vanishes
    // tail-first instead of disappearing all at once
    while (t.points.length && now - t.points[0].t >= LASER_FADE_MS) {
      t.points.shift();
    }
    if (t.points.length) {
      t.updatedAt = t.points[t.points.length - 1].t;
    }
  }
  return list.filter((t) => t.points.length > 0);
};

const prune = (now: number) => {
  trails = pruneList(trails, now);
  remoteTrails = pruneList(remoteTrails, now);
  if (activeId !== null && !trails.some((t) => t.id === activeId)) {
    activeId = null;
  }
  for (const id of remoteOpen) {
    if (!remoteTrails.some((t) => t.clientId === id)) remoteOpen.delete(id);
  }
};

export const laserStart = (x: number, y: number): void => {
  const now = Date.now();
  prune(now);
  const trail: LaserTrail = { id: nextId++, points: [{ x, y, t: now }], updatedAt: now };
  trails.push(trail);
  activeId = trail.id;
  laserSetCursor(x, y);
};

export const laserMove = (x: number, y: number): void => {
  const now = Date.now();
  if (activeId === null) return;
  const trail = trails.find((t) => t.id === activeId);
  if (!trail) {
    activeId = null;
    return;
  }
  const last = trail.points[trail.points.length - 1];
  if (last) {
    const dx = x - last.x;
    const dy = y - last.y;
    if (dx * dx + dy * dy < MIN_DIST_SQ) {
      trail.updatedAt = now;
      laserSetCursor(x, y);
      return;
    }
  }
  trail.points.push({ x, y, t: now });
  // cap length so a long press can't grow unbounded
  if (trail.points.length > 500) {
    trail.points.splice(0, trail.points.length - 500);
  }
  trail.updatedAt = now;
  laserSetCursor(x, y);
};

export const laserEnd = (): void => {
  activeId = null;
};

export const laserCancel = (): void => {
  if (activeId !== null) {
    trails = trails.filter((t) => t.id !== activeId);
    activeId = null;
  }
  laserHideCursor();
};

export const laserSetCursor = (x: number, y: number): void => {
  cursor = { x, y, visible: true, updatedAt: Date.now() };
};

export const laserHideCursor = (): void => {
  cursor.visible = false;
};

/** Trails that haven't fully faded yet (also prunes expired ones). */
export const getLaserTrails = (): LaserTrail[] => {
  prune(Date.now());
  return [...trails, ...remoteTrails];
};

/** Feed a point received from a collaborator into their fading trail. */
export const remoteLaserPoint = (
  clientId: string,
  x: number,
  y: number,
  drawing: boolean,
): void => {
  const now = Date.now();
  if (!drawing) {
    remoteOpen.delete(clientId);
    return;
  }
  prune(now);
  let trail = remoteOpen.has(clientId)
    ? remoteTrails.find((t) => t.clientId === clientId)
    : undefined;
  if (!trail) {
    trail = {
      id: nextId++,
      clientId,
      points: [],
      updatedAt: now,
      color: peerColor(clientId),
    };
    remoteTrails.push(trail);
    remoteOpen.add(clientId);
  }
  trail.points.push({ x, y, t: now });
  if (trail.points.length > 500) {
    trail.points.splice(0, trail.points.length - 500);
  }
  trail.updatedAt = now;
};

/** Drop fading remote trails, for one peer or all (leave/disconnect). */
export const clearRemoteLaser = (clientId?: string): void => {
  if (clientId === undefined) {
    remoteTrails = [];
    remoteOpen.clear();
    return;
  }
  remoteTrails = remoteTrails.filter((t) => t.clientId !== clientId);
  remoteOpen.delete(clientId);
};

export const getLaserCursor = () => cursor;

export const isLaserActive = (): boolean => activeId !== null;
