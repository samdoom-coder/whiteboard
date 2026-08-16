import { useState } from "react";
import { useStore } from "../core/store";
import { runAICommand, AI_SUGGESTIONS } from "../ai/engine";
import { getEngine } from "../render/engineRegistry";
import { Icon } from "./Icon";

interface Msg {
  role: "user" | "ai";
  text: string;
}

export function AIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);

  if (!open) return null;

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMsgs((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const res = runAICommand(trimmed);
      const s = useStore.getState();
      if (res.elements) {
        if (res.replaceCanvas) {
          s.replaceElements(res.elements);
        } else {
          s.replaceElements([...s.doc.elements, ...res.elements]);
        }
        requestAnimationFrame(() => getEngine().fitToScreen());
      }
      setMsgs((m) => [...m, { role: "ai", text: res.message }]);
      setThinking(false);
    }, 500);
  };

  return (
    <div className={`ai-panel floating panel-enter ${collapsed ? "collapsed" : ""}`}>
      <div className="ai-header">
        <span className="row" style={{ gap: 6 }}>
          <Icon name="sparkle" size={15} />
          AI assistant
        </span>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn-icon" onClick={() => setCollapsed((v) => !v)} title={collapsed ? "Expand" : "Collapse"}>
            <Icon name="chevron" size={14} style={{ transform: collapsed ? "rotate(180deg)" : undefined }} />
          </button>
          <button className="btn btn-icon" onClick={onClose} title="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="ai-body">
            {!msgs.length && (
              <div className="ai-intro">
                <p>Describe what you want, and I'll draw it or change what's on the canvas.</p>
                <div className="ai-suggestions">
                  {AI_SUGGESTIONS.map((sugg) => (
                    <button key={sugg} className="chip" onClick={() => run(sugg)}>
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <span className="ai-msg-label">{m.role === "user" ? "You" : "AI"}</span>
                <div className="ai-msg-text">{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div className="ai-msg ai">
                <span className="ai-msg-label">AI</span>
                <div className="ai-thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
          <div className="ai-input-row">
            <input
              className="ai-input"
              placeholder="e.g. Add Redis between the API and database…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run(input);
                if (e.key === "Escape") onClose();
              }}
            />
            <button className="btn primary" onClick={() => run(input)} disabled={thinking || !input.trim()}>
              <Icon name="send" size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}