/**
 * Ephemeral laser-pointer trails.
 *
 * Trails live outside the document/undo history on purpose: they are a
 * presentation aid, never persisted, never synced, and they fade away on
 * their own. The canvas engine reads this module every frame and renders
 * the trails with a glow + fade.
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
}

export const LASER_FADE_MS = 2000;

let trails: LaserTrail[] = [];
let activeId: number | null = null;
let nextId = 1;

let cursor: { x: number; y: number; visible: boolean; updatedAt: number } = {
  x: 0,
  y: 0,
  visible: false,
  updatedAt: 0,
};

const MIN_DIST_SQ = 2.5 * 2.5;

const prune = (now: number) => {
  for (const t of trails) {
    // drop faded points from the head of the trail so it vanishes
    // tail-first instead of disappearing all at once
    while (t.points.length && now - t.points[0].t >= LASER_FADE_MS) {
      t.points.shift();
    }
    if (t.points.length) {
      t.updatedAt = t.points[t.points.length - 1].t;
    }
  }
  trails = trails.filter((t) => t.points.length > 0);
  if (activeId !== null && !trails.some((t) => t.id === activeId)) {
    activeId = null;
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
  return trails;
};

export const getLaserCursor = () => cursor;

export const isLaserActive = (): boolean => activeId !== null;
