import { useCallback, useEffect, useMemo, useRef } from "react";
import { isMockMode } from "@/gateway/adapter-provider";
import { useProjectionStore } from "@/perception/projection-store";
import type { AgentProjection } from "@/perception/types";
import { AgentCharacter2D5 } from "./characters/AgentCharacter2D5";
import { SUB_AGENT_SLOTS } from "./characters/constants";
import { SubAgentGhost, allocateSubAgentSlots } from "./characters/SubAgentGhost";
import { DESK_CONFIGS } from "./config";
import type { DeskConfig } from "./types";
import { ControlPanel } from "./hud/ControlPanel";
import { EventLogPanel } from "./hud/EventLogPanel";
import { EventTicker } from "./hud/EventTicker";
import { FooterBar } from "./hud/FooterBar";
import { GatewayStatus } from "./hud/GatewayStatus";
import { HudBar } from "./hud/HudBar";
import { DEMO_BUTTONS, startAutoPlay } from "./hud/MockDemoDriver";
import { usePerceptionEngine } from "./hud/perception-context";
import { StatsPanel } from "./hud/StatsPanel";
import { OfficeStage } from "./scene/OfficeStage";
import { Desk } from "./workspace/Desk";
import { CronZone } from "./zones/CronZone";
import { GatewayZone } from "./zones/GatewayZone";
import { MemoryZone } from "./zones/MemoryZone";
import { OpsZone } from "./zones/OpsZone";
import { ProjectZone } from "./zones/ProjectZone";
import { StaffZone } from "./zones/StaffZone";

function agentStateToDeskStatus(state: string): "idle" | "busy" | "blocked" | "heartbeat" {
  switch (state) {
    case "WORKING":
    case "TOOL_CALL":
    case "COLLABORATING":
    case "INCOMING":
    case "ACK":
      return "busy";
    case "BLOCKED":
      return "blocked";
    default:
      return "idle";
  }
}

interface DeskAssignment {
  desk: DeskConfig;
  agent: AgentProjection | undefined;
}

const STAFF_ZONE = { left: 86, top: 350, width: 820, height: 360 };
const DESK_WIDTH = 160;
const DESK_HEIGHT = 108;
const DESK_GAP_X = 30;
const DESK_GAP_Y = 50;

function computeDynamicDeskConfigs(count: number): DeskConfig[] {
  if (count <= DESK_CONFIGS.length) {
    return DESK_CONFIGS.slice(0, Math.max(count, DESK_CONFIGS.length));
  }

  const cols = Math.min(count, Math.floor((STAFF_ZONE.width + DESK_GAP_X) / (DESK_WIDTH + DESK_GAP_X)));
  const rows = Math.ceil(count / cols);

  const totalW = cols * DESK_WIDTH + (cols - 1) * DESK_GAP_X;
  const totalH = rows * DESK_HEIGHT + (rows - 1) * DESK_GAP_Y;
  const startX = STAFF_ZONE.left + Math.max(0, (STAFF_ZONE.width - totalW) / 2);
  const startY = STAFF_ZONE.top + Math.max(0, (STAFF_ZONE.height - totalH) / 2);

  const desks: DeskConfig[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    desks.push({
      id: `desk-dyn-${i}`,
      agentName: `Agent ${i + 1}`,
      role: "",
      position: {
        left: startX + col * (DESK_WIDTH + DESK_GAP_X),
        top: startY + row * (DESK_HEIGHT + DESK_GAP_Y),
      },
    });
  }
  return desks;
}

function assignAgentsToDesks(agents: Map<string, AgentProjection>): DeskAssignment[] {
  const agentList = Array.from(agents.values());
  const deskConfigs = agentList.length > DESK_CONFIGS.length
    ? computeDynamicDeskConfigs(agentList.length)
    : DESK_CONFIGS;

  return deskConfigs.map((desk, i) => {
    const agent = agentList[i];
    if (agent) {
      return {
        desk: {
          ...desk,
          agentName: agent.agentId,
          role: agent.role,
          status: agentStateToDeskStatus(agent.state),
        },
        agent,
      };
    }
    return { desk, agent: undefined };
  });
}

export function LivingOfficeView() {
  const agents = useProjectionStore((s) => s.agents);
  const engine = usePerceptionEngine();
  const autoPlayCleanup = useRef<(() => void) | null>(null);

  const assignments = useMemo(() => assignAgentsToDesks(agents), [agents]);

  const subAgentEntries = Array.from(agents.values()).filter(
    (a) => a.state === "COLLABORATING",
  );
  const subAgentSlots = allocateSubAgentSlots(
    subAgentEntries.map((a) => ({ agentId: a.agentId, name: a.role })),
  );

  // Auto-play in mock mode
  useEffect(() => {
    if (!isMockMode() || !engine) return;
    autoPlayCleanup.current = startAutoPlay(engine);
    return () => {
      autoPlayCleanup.current?.();
      autoPlayCleanup.current = null;
    };
  }, [engine]);

  const demoButtons = useMemo(() => {
    if (!engine) return [];
    return DEMO_BUTTONS.map((btn) => ({
      label: btn.label,
      color: btn.color,
      hoverColor: btn.hoverColor,
      onClick: () => void btn.fn(engine),
    }));
  }, [engine]);

  const handleNoop = useCallback(() => {}, []);

  return (
    <div
      className="living-office"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--lo-app-bg)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
        color: "var(--lo-text)",
      }}
    >
      {/* Background radials */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--lo-app-overlay)",
          pointerEvents: "none",
        }}
      />

      {/* HUD Top Bar */}
      <HudBar
        left={<GatewayStatus />}
        center={<EventTicker />}
        right={<StatsPanel />}
      />

      {/* Main Stage */}
      <div style={{ position: "absolute", inset: "46px 14px 46px 14px" }}>
        <OfficeStage>
          <GatewayZone />
          <OpsZone />
          <CronZone />
          <StaffZone />
          <ProjectZone />
          <MemoryZone />

          {assignments.map(({ desk, agent }) => (
            <Desk
              key={desk.id}
              config={desk}
              status={agent ? agentStateToDeskStatus(agent.state) : "idle"}
              bubble={agent?.taskSummary ?? ""}
            />
          ))}

          {assignments.map(({ desk, agent }) => (
            <AgentCharacter2D5
              key={`char-${desk.id}`}
              agentId={agent?.agentId ?? desk.id}
              deskId={desk.id}
              name={agent?.agentId ?? desk.agentName}
              perceivedState={agent?.state ?? "IDLE"}
              toolName={agent?.tool}
            />
          ))}

          {subAgentSlots.map((slot) => {
            const pos = SUB_AGENT_SLOTS[slot.slotIndex];
            if (!pos) return null;
            return (
              <SubAgentGhost
                key={`sub-${slot.agentId}`}
                agentId={slot.agentId}
                name={slot.name}
                position={pos}
                active
              />
            );
          })}
        </OfficeStage>
      </div>

      {/* Footer Bar */}
      <FooterBar
        left={<EventLogPanel />}
        right={
          <ControlPanel
            buttons={demoButtons.length > 0 ? demoButtons : [{ label: "—", color: "#555", hoverColor: "#666", onClick: handleNoop }]}
          />
        }
      />
    </div>
  );
}
