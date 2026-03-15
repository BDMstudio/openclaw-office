import { useEffect, useState } from "react";
import { CharacterBody } from "./CharacterBody";
import { CHARACTER_SIZE, CHARACTER_Z, type Position2D } from "./constants";

interface SubAgentGhostProps {
  agentId: string;
  name: string;
  position: Position2D;
  active: boolean;
}

export function SubAgentGhost({ agentId, name, position, active }: SubAgentGhostProps) {
  const [visible, setVisible] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (active) {
      setRemoved(false);
      // Trigger fade-in on next frame for transition to work
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setRemoved(true), 600);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (removed && !active) return null;

  return (
    <div
      data-agent-id={agentId}
      data-subagent
      className={`lo-subagent-ghost ${visible ? "lo-subagent-visible" : ""}`}
      style={{
        position: "absolute",
        left: position.left - CHARACTER_SIZE / 2,
        top: position.top - CHARACTER_SIZE / 2,
        width: CHARACTER_SIZE,
        transform: `translateZ(${CHARACTER_Z}px)`,
        zIndex: 99,
        pointerEvents: "none",
      }}
    >
      <CharacterBody
        name={`tmp:${name}`}
        agentId={agentId}
        cssClass="lo-subagent-body"
        gazeDirection={0}
        state="COLLABORATING"
      />
    </div>
  );
}

// --- Sub-agent slot manager ---

export interface SubAgentSlotState {
  agentId: string;
  name: string;
  slotIndex: number;
}

const MAX_VISIBLE = 3;

export function allocateSubAgentSlots(
  activeSubAgents: Array<{ agentId: string; name: string }>,
): SubAgentSlotState[] {
  return activeSubAgents.slice(0, MAX_VISIBLE).map((sa, i) => ({
    agentId: sa.agentId,
    name: sa.name,
    slotIndex: i,
  }));
}
