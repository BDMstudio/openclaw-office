import type { DeskStatus } from "../types";

const STATUS_COLORS: Record<DeskStatus, string> = {
  idle: "var(--lo-good)",
  busy: "var(--lo-warn)",
  blocked: "var(--lo-bad)",
  heartbeat: "var(--lo-cyan)",
};

interface StatusRingProps {
  status: DeskStatus;
}

export function StatusRing({ status }: StatusRingProps) {
  const color = STATUS_COLORS[status];
  const isActive = status === "busy" || status === "blocked";

  return (
    <div
      className={isActive ? "lo-desk-ring-active" : "lo-desk-ring-idle"}
      style={{
        position: "absolute",
        right: 10,
        top: 10,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 12px ${color}`,
      }}
    />
  );
}
