import type { PerceivedAgentState } from "@/perception/types";

interface StatusIndicatorProps {
  state: PerceivedAgentState;
  toolName?: string;
}

const INDICATOR_STYLE: React.CSSProperties = {
  position: "absolute",
  top: -28,
  left: "50%",
  transform: "translateX(-50%)",
  fontSize: 10,
  fontWeight: 700,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  zIndex: 10,
  lineHeight: "16px",
};

export function StatusIndicator({ state, toolName }: StatusIndicatorProps) {
  switch (state) {
    case "WORKING":
      return (
        <div
          className="lo-status-indicator lo-status-working"
          style={{
            ...INDICATOR_STYLE,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span className="lo-status-gear">⚙</span>
          <span style={{ color: "#7dd5ff", fontSize: 9 }}>处理中</span>
        </div>
      );

    case "TOOL_CALL":
      return (
        <div
          className="lo-status-indicator lo-status-tool"
          style={{
            ...INDICATOR_STYLE,
            background: "rgba(251, 191, 36, 0.15)",
            border: "1px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 6,
            padding: "1px 6px",
            color: "#fbbf24",
          }}
        >
          🔧 {toolName ?? "tool"}
        </div>
      );

    case "WAITING":
      return (
        <div
          className="lo-status-indicator lo-status-waiting"
          style={{
            ...INDICATOR_STYLE,
            color: "#94a3b8",
          }}
        >
          <span className="lo-status-hourglass">⏳</span>
        </div>
      );

    case "BLOCKED":
      return (
        <div
          className="lo-status-indicator lo-status-blocked"
          style={{
            ...INDICATOR_STYLE,
            color: "#ff667a",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          <span className="lo-status-alert">❗</span>
        </div>
      );

    case "COLLABORATING":
      return (
        <div
          className="lo-status-indicator lo-status-collab"
          style={{
            ...INDICATOR_STYLE,
            display: "flex",
            alignItems: "center",
            gap: 3,
            color: "#a78bfa",
          }}
        >
          <span className="lo-status-collab-icon">🤝</span>
          <span style={{ fontSize: 9 }}>协作</span>
        </div>
      );

    case "INCOMING":
      return (
        <div
          className="lo-status-indicator lo-status-incoming"
          style={{
            ...INDICATOR_STYLE,
            color: "#5cc8ff",
          }}
        >
          <span className="lo-status-incoming-icon">📨</span>
        </div>
      );

    case "RETURNING":
      return (
        <div
          className="lo-status-indicator lo-status-returning"
          style={{
            ...INDICATOR_STYLE,
            color: "#34d399",
            fontSize: 9,
          }}
        >
          ✅ 完成回报
        </div>
      );

    case "RECOVERED":
      return (
        <div
          className="lo-status-indicator lo-status-recovered"
          style={{
            ...INDICATOR_STYLE,
            color: "#34d399",
            fontSize: 9,
          }}
        >
          🔄 恢复
        </div>
      );

    default:
      return null;
  }
}
