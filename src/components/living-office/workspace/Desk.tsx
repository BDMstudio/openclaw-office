import type { DeskConfig, DeskStatus } from "../types";
import { DeskBubble } from "./DeskBubble";
import { StatusRing } from "./StatusRing";

interface DeskProps {
  config: DeskConfig;
  status?: DeskStatus;
  bubble?: string;
}

export function Desk({ config, status = "idle", bubble = "" }: DeskProps) {
  const isHeartbeat = status === "heartbeat";

  return (
    <div
      data-desk-id={config.id}
      style={{
        position: "absolute",
        left: config.position.left,
        top: config.position.top,
        width: 160,
        height: 108,
        transform: "translateZ(12px)",
      }}
    >
      {/* Heartbeat pulse ring */}
      {isHeartbeat && (
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: 24,
            border: "2px solid rgba(92,200,255,.16)",
            animation: "lo-pulse 1.6s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Surface */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--lo-glass-bg)",
          borderRadius: 20,
          border: "var(--lo-glass-border)",
          boxShadow: "var(--lo-shadow)",
        }}
      />

      {/* Monitor */}
      <div
        className={status === "busy" ? "lo-desk-monitor-active" : "lo-desk-monitor-idle"}
        style={{
          position: "absolute",
          left: 46,
          top: 18,
          width: 68,
          height: 30,
          borderRadius: 8,
          background:
            status === "busy"
              ? `linear-gradient(180deg, color-mix(in srgb, var(--lo-cyan) 50%, transparent), color-mix(in srgb, var(--lo-cyan) 15%, transparent))`
              : `linear-gradient(180deg, color-mix(in srgb, var(--lo-cyan) 35%, transparent), color-mix(in srgb, var(--lo-cyan) 8%, transparent))`,
          border: `1px solid color-mix(in srgb, var(--lo-cyan) 25%, transparent)`,
          boxShadow: status === "busy"
            ? `0 0 30px color-mix(in srgb, var(--lo-cyan) 25%, transparent)`
            : `0 0 24px color-mix(in srgb, var(--lo-cyan) 14%, transparent)`,
          transition: "background 0.5s ease, box-shadow 0.5s ease",
        }}
      />

      <StatusRing status={status} />

      {/* Agent name */}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          fontSize: 11,
          color: "var(--lo-text)",
          fontWeight: 700,
        }}
      >
        {config.agentName}
      </div>

      {/* Role meta */}
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          fontSize: 10,
          color: "var(--lo-muted)",
        }}
      >
        {config.role}
      </div>

      <DeskBubble text={bubble} />
    </div>
  );
}
