import { useEffect, useRef, useState } from "react";
import { transition, resetToIdle } from "@/perception/state-machine";
import type { PerceivedAgentState, PerceivedKind } from "@/perception/types";
import { CharacterBody } from "./CharacterBody";
import {
  AGENT_HOME_POSITIONS,
  CHARACTER_SIZE,
  CHARACTER_Z,
  IDLE_WANDER_DURATION,
  MOVE_DURATION_MS,
  MOVE_EASING,
  type Position2D,
} from "./constants";
import { useIdleBehavior } from "./useIdleBehavior";

interface AgentCharacter2D5Props {
  agentId: string;
  deskId: string;
  name: string;
  perceivedState: PerceivedAgentState;
  eventKind?: PerceivedKind;
  targetPosition?: Position2D;
  toolName?: string;
}

export function AgentCharacter2D5({
  agentId,
  deskId,
  name,
  perceivedState,
  eventKind,
  targetPosition,
  toolName,
}: AgentCharacter2D5Props) {
  const homePos = AGENT_HOME_POSITIONS[deskId] ?? { left: 0, top: 0 };
  const [internalState, setInternalState] = useState<PerceivedAgentState>("IDLE");
  const [cssClass, setCssClass] = useState("idle");
  const [walking, setWalking] = useState(false);
  const [position, setPosition] = useState<Position2D>(homePos);
  const prevStateRef = useRef<PerceivedAgentState>("IDLE");
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const idle = useIdleBehavior(internalState, homePos);

  useEffect(() => {
    if (!eventKind) return;

    const result = transition(prevStateRef.current, eventKind);
    prevStateRef.current = result.nextState;
    setInternalState(result.nextState);
    setCssClass(result.visual.cssClass);

    if (result.visual.shouldMove && targetPosition) {
      setWalking(true);
      setPosition(targetPosition);

      clearTimeout(walkTimerRef.current);
      walkTimerRef.current = setTimeout(() => {
        setWalking(false);
      }, MOVE_DURATION_MS);
    }
  }, [eventKind, targetPosition]);

  useEffect(() => {
    if (perceivedState !== internalState && !eventKind) {
      prevStateRef.current = perceivedState;
      setInternalState(perceivedState);
      setCssClass(getCssClassForState(perceivedState));
    }
  }, [perceivedState, internalState, eventKind]);

  // DONE → IDLE auto-transition
  useEffect(() => {
    if (internalState !== "DONE") return;
    const timer = setTimeout(() => {
      const result = resetToIdle();
      prevStateRef.current = result.nextState;
      setInternalState(result.nextState);
      setCssClass(result.visual.cssClass);
      setPosition(homePos);
    }, 1200);
    return () => clearTimeout(timer);
  }, [internalState, homePos]);

  // RETURNING → walk home
  useEffect(() => {
    if (internalState !== "RETURNING") return;
    setWalking(true);
    setPosition(homePos);
    const timer = setTimeout(() => {
      setWalking(false);
    }, MOVE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [internalState, homePos]);

  useEffect(() => {
    return () => clearTimeout(walkTimerRef.current);
  }, []);

  // Compute final visual position = base + idle wander offset
  const isIdleState = internalState === "IDLE";
  const finalLeft = position.left + (isIdleState ? idle.wanderOffset.left : 0);
  const finalTop = position.top + (isIdleState ? idle.wanderOffset.top : 0);

  const isMoving = walking || idle.isWandering;
  const moveDuration = walking ? MOVE_DURATION_MS : IDLE_WANDER_DURATION;
  const moveEasing = walking ? MOVE_EASING : "ease-in-out";

  const stateClasses = [
    `lo-char-state-${cssClass}`,
    isMoving ? "lo-char-walking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-agent-id={agentId}
      data-agent-state={internalState}
      className={`lo-character ${stateClasses}`}
      style={{
        position: "absolute",
        left: finalLeft - CHARACTER_SIZE / 2,
        top: finalTop - CHARACTER_SIZE / 2,
        width: CHARACTER_SIZE,
        transform: `translateZ(${CHARACTER_Z}px)`,
        transition: isMoving
          ? `left ${moveDuration}ms ${moveEasing}, top ${moveDuration}ms ${moveEasing}`
          : "left 0.3s ease, top 0.3s ease",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <CharacterBody
        name={name}
        agentId={agentId}
        cssClass={stateClasses}
        gazeDirection={idle.gazeDirection}
        state={internalState}
        toolName={toolName}
      />
    </div>
  );
}

function getCssClassForState(state: PerceivedAgentState): string {
  const map: Record<PerceivedAgentState, string> = {
    IDLE: "idle",
    INCOMING: "incoming",
    ACK: "ack",
    WORKING: "working",
    TOOL_CALL: "tool-call",
    WAITING: "waiting",
    COLLABORATING: "collaborating",
    RETURNING: "returning",
    DONE: "done",
    BLOCKED: "blocked",
    RECOVERED: "recovered",
  };
  return map[state];
}
