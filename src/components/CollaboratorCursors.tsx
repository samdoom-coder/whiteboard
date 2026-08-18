import { useCollab } from "../core/collaboration";
import { useStore } from "../core/store";
import { worldToScreen } from "../render/camera";

/**
 * Overlays the live cursors of remote collaborators on the canvas.
 * Cursor positions are stored in world coordinates and projected to screen
 * using the local camera, so peers' pointers stay anchored to the board
 * regardless of each user's pan/zoom.
 */
export function CollaboratorCursors() {
  const cursors = useCollab((s) => s.cursors);
  const view = useStore((s) => s.doc.scene.view);
  const entries = Object.entries(cursors);
  if (!entries.length) return null;

  return (
    <>
      {entries.map(([id, c]) => {
        const p = worldToScreen(c.x, c.y, view);
        return (
          <div
            key={id}
            className="collab-cursor"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <svg
              className="collab-cursor-arrow"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden
            >
              <path
                d="M2 2 L20 9 L12.5 10.5 L9.5 17.5 Z"
                fill={c.color}
                stroke="#fff"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <span className="collab-cursor-name" style={{ background: c.color }}>
              {c.name}
            </span>
          </div>
        );
      })}
    </>
  );
}