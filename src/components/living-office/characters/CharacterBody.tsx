import type { PerceivedAgentState } from "@/perception/types";
import { StatusIndicator } from "./StatusIndicator";
import {
  ARM_HEIGHT,
  ARM_WIDTH,
  BODY_RADIUS,
  BODY_SIZE,
  CHARACTER_SIZE,
  EYE_COLOR,
  EYE_SIZE,
  EYE_SPACING,
  HEAD_SIZE,
  SHADOW_COLOR,
  SKIN_COLOR,
  TAG_BG,
  TAG_COLOR,
  getAgentColor,
} from "./constants";

interface CharacterBodyProps {
  name: string;
  agentId: string;
  cssClass: string;
  gazeDirection: number;
  state: PerceivedAgentState;
  toolName?: string;
}

export function CharacterBody({
  name,
  agentId,
  cssClass,
  gazeDirection,
  state,
  toolName,
}: CharacterBodyProps) {
  const [colorFrom, colorTo] = getAgentColor(agentId);
  const eyeOffsetX = gazeDirection * 1.5;

  return (
    <div
      className={`lo-char-body ${cssClass}`}
      style={{
        position: "relative",
        width: CHARACTER_SIZE,
        height: CHARACTER_SIZE + 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Status indicator */}
      <StatusIndicator state={state} toolName={toolName} />

      {/* Tag (name label) */}
      <div
        className="lo-char-tag"
        style={{
          position: "absolute",
          top: -14,
          left: "50%",
          transform: "translateX(-50%) translateZ(18px)",
          fontSize: 9,
          fontWeight: 600,
          color: TAG_COLOR,
          background: TAG_BG,
          borderRadius: 8,
          padding: "1px 6px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          lineHeight: "14px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {name}
      </div>

      {/* Head with eyes */}
      <div
        className="lo-char-head"
        style={{
          width: HEAD_SIZE,
          height: HEAD_SIZE,
          borderRadius: "50%",
          background: SKIN_COLOR,
          boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.2)",
          flexShrink: 0,
          zIndex: 2,
          position: "relative",
        }}
      >
        {/* Left eye */}
        <div
          className="lo-char-eye lo-char-eye-left"
          style={{
            position: "absolute",
            width: EYE_SIZE,
            height: EYE_SIZE,
            borderRadius: "50%",
            background: EYE_COLOR,
            top: HEAD_SIZE * 0.38,
            left: HEAD_SIZE / 2 - EYE_SPACING / 2 - EYE_SIZE / 2 + eyeOffsetX,
            transition: "left 0.4s ease",
          }}
        />
        {/* Right eye */}
        <div
          className="lo-char-eye lo-char-eye-right"
          style={{
            position: "absolute",
            width: EYE_SIZE,
            height: EYE_SIZE,
            borderRadius: "50%",
            background: EYE_COLOR,
            top: HEAD_SIZE * 0.38,
            left: HEAD_SIZE / 2 + EYE_SPACING / 2 - EYE_SIZE / 2 + eyeOffsetX,
            transition: "left 0.4s ease",
          }}
        />
      </div>

      {/* Body with arms */}
      <div
        style={{
          position: "relative",
          marginTop: -3,
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
        }}
      >
        {/* Left arm */}
        <div
          className="lo-char-arm lo-char-arm-left"
          style={{
            width: ARM_WIDTH,
            height: ARM_HEIGHT,
            borderRadius: "3px 3px 2px 2px",
            background: `linear-gradient(180deg, ${colorFrom}cc, ${colorTo}cc)`,
            marginRight: -1,
            marginTop: 2,
            transformOrigin: "top center",
          }}
        />

        {/* Torso */}
        <div
          className="lo-char-torso"
          style={{
            width: BODY_SIZE,
            height: BODY_SIZE,
            borderRadius: `${BODY_RADIUS}px ${BODY_RADIUS}px 6px 6px`,
            background: `linear-gradient(180deg, ${colorFrom}, ${colorTo})`,
            boxShadow: `0 0 12px ${colorFrom}40, 0 4px 12px rgba(0,0,0,0.3)`,
          }}
        />

        {/* Right arm */}
        <div
          className="lo-char-arm lo-char-arm-right"
          style={{
            width: ARM_WIDTH,
            height: ARM_HEIGHT,
            borderRadius: "3px 3px 2px 2px",
            background: `linear-gradient(180deg, ${colorFrom}cc, ${colorTo}cc)`,
            marginLeft: -1,
            marginTop: 2,
            transformOrigin: "top center",
          }}
        />
      </div>

      {/* Shadow */}
      <div
        className="lo-char-shadow"
        style={{
          width: BODY_SIZE + 10,
          height: 6,
          borderRadius: "50%",
          background: SHADOW_COLOR,
          filter: "blur(4px)",
          marginTop: 2,
          zIndex: 0,
        }}
      />

      {/* Status ring glow under feet */}
      {state !== "IDLE" && state !== "DONE" && (
        <div
          className="lo-char-status-ring"
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: BODY_SIZE + 14,
            height: 8,
            borderRadius: "50%",
            background: getStatusRingColor(state),
            filter: "blur(5px)",
            opacity: 0.6,
            zIndex: 0,
          }}
        />
      )}
    </div>
  );
}

function getStatusRingColor(state: PerceivedAgentState): string {
  switch (state) {
    case "WORKING":
    case "TOOL_CALL":
      return "rgba(92, 200, 255, 0.6)";
    case "BLOCKED":
      return "rgba(255, 102, 122, 0.7)";
    case "COLLABORATING":
      return "rgba(167, 139, 250, 0.6)";
    case "WAITING":
      return "rgba(148, 163, 184, 0.4)";
    case "INCOMING":
    case "ACK":
      return "rgba(92, 200, 255, 0.4)";
    case "RETURNING":
    case "RECOVERED":
      return "rgba(52, 211, 153, 0.5)";
    default:
      return "transparent";
  }
}
