import { useEffect, useRef, useState } from "react";
import { useCollab } from "../core/collaboration";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  onToggle: (v: boolean) => void;
}

const statusLabel: Record<string, string> = {
  local: "Offline",
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Reconnecting…",
};

export function CollaborationMenu({ open, onToggle }: Props) {
  const { roomId, status, peers, name, error, connect, disconnect, setName, inviteUrl } = useCollab();
  const [roomInput, setRoomInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  const startSession = () => {
    const id = (
      roomInput.trim() ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10))
    ).toLowerCase();
    connect(id);
  };

  const joinRoom = () => {
    let input = roomInput.trim();
    if (!input) return;
    // accept a pasted invite link
    try {
      const url = new URL(input);
      const room = url.searchParams.get("room");
      if (room) input = room;
    } catch {
      /* plain room code */
    }
    if (input) connect(input);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const live = status === "connected";
  const statusColor =
    status === "connected"
      ? "#51cf66"
      : status === "disconnected"
        ? "#ff6b6b"
        : status === "connecting"
          ? "#ffa94d"
          : "#9a9892";

  return (
    <div className="collab-wrap" ref={ref}>
      <button
        className="btn btn-icon collab-button"
        onClick={() => onToggle(!open)}
        title="Real-time collaboration"
        aria-label="Real-time collaboration"
        aria-expanded={open}
      >
        <Icon name="share" size={17} />
        {live && <span className="collab-live-dot" />}
      </button>

      {open && (
        <div className="popover collab-popover floating panel-enter" onClick={(e) => e.stopPropagation()}>
          <div className="collab-header">
            <span className="collab-title">
              <Icon name="share" size={14} />
              Collaborate
            </span>
            <span className="collab-status" style={{ color: statusColor }}>
              <span className="collab-status-dot" style={{ background: statusColor }} />
              {statusLabel[status] ?? status}
              {live && peers.length > 0 ? ` · ${peers.length} ${peers.length === 1 ? "peer" : "peers"}` : ""}
            </span>
          </div>

          {live && (
            <div className="collab-room-row">
              <span className="collab-room-id" title={roomId ?? undefined}>
                {roomId}
              </span>
              <button className="btn" onClick={copyLink} title="Copy invite link">
                <Icon name={copied ? "check" : "copy"} size={14} />
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}

          {!live ? (
            <>
              <div className="collab-section">
                <span className="style-label">Session</span>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    className="collab-input"
                    placeholder="New room code or pasted link…"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinRoom();
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn primary" onClick={startSession}>
                    <Icon name="plus" size={14} />
                    New session
                  </button>
                  <button className="btn" disabled={!roomInput.trim()} onClick={joinRoom}>
                    <Icon name="send" size={14} />
                    Join
                  </button>
                </div>
              </div>
              <p className="collab-hint">
                Share the link with others to draw on the same canvas in real time. The relay
                server must be running (<code>npm run server</code>).
              </p>
            </>
          ) : (
            <div className="collab-section">
              <span className="style-label">People here</span>
              {peers.length === 0 ? (
                <span className="collab-empty">No one else yet — share the link to invite.</span>
              ) : (
                <ul className="collab-peers">
                  {peers.map((p) => (
                    <li key={p.clientId} className="collab-peer">
                      <span className="collab-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="collab-section">
            <span className="style-label">Your name</span>
            {editingName ? (
              <input
                className="collab-input"
                autoFocus
                defaultValue={name}
                maxLength={24}
                onBlur={(e) => {
                  setName(e.target.value);
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <button className="collab-name" onClick={() => setEditingName(true)}>
                <span className="collab-avatar">{name.slice(0, 1).toUpperCase()}</span>
                {name}
                <Icon name="pencil" size={13} />
              </button>
            )}
          </div>

          {error && <div className="collab-error">{error}</div>}

          {live && (
            <button
              className="btn danger"
              onClick={() => {
                disconnect();
                onToggle(false);
              }}
            >
              <Icon name="close" size={14} />
              Leave session
            </button>
          )}
        </div>
      )}
    </div>
  );
}