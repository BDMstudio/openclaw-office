import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

enableMapSet();

import {
  MAX_NARRATIVE_LOGS,
  type AgentProjection,
  type NarrativeLog,
  type PerceivedAgentState,
  type PerceivedEvent,
  type SceneAreaState,
} from "./types";

// --- Kind → State 映射 ---

const KIND_TO_STATE: Record<string, PerceivedAgentState> = {
  ARRIVE: "INCOMING",
  DISPATCH: "WORKING",
  ACK: "ACK",
  FOCUS: "WORKING",
  CALL_TOOL: "TOOL_CALL",
  WAIT: "WAITING",
  SPAWN_SUBAGENT: "COLLABORATING",
  COLLAB: "COLLABORATING",
  RETURN: "DONE",
  BROADCAST_CRON: "IDLE",
  POLL_HEARTBEAT: "IDLE",
  BLOCK: "BLOCKED",
  RECOVER: "RECOVERED",
};

// --- Store 类型 ---

interface ProjectionStoreState {
  agents: Map<string, AgentProjection>;
  narrativeLogs: NarrativeLog[];
  sceneArea: SceneAreaState;

  initAgent: (agentId: string, role: string, deskId: string) => void;
  initAgentsBatch: (agents: Array<{ agentId: string; role: string; deskId: string }>) => void;
  applyPerceivedEvent: (event: PerceivedEvent) => void;
  resetAgent: (agentId: string) => void;
  getSnapshot: () => {
    agents: Map<string, AgentProjection>;
    narrativeLogs: NarrativeLog[];
    sceneArea: SceneAreaState;
  };
}

function createDefaultSceneArea(): SceneAreaState {
  return {
    gatewayStream: [
      { label: "WebSocket", detail: "连接中", active: false },
      { label: "Event Bus", detail: "就绪", active: false },
      { label: "RPC", detail: "就绪", active: false },
      { label: "Health", detail: "正常", active: true },
    ],
    cronTasks: [],
    memoryItems: [],
    projectTasks: [],
    opsRules: [],
  };
}

export const useProjectionStore = create<ProjectionStoreState>()(
  immer((set, get) => ({
    agents: new Map<string, AgentProjection>(),
    narrativeLogs: [],
    sceneArea: createDefaultSceneArea(),

    initAgent: (agentId: string, role: string, deskId: string) => {
      set((state) => {
        state.agents.set(agentId, {
          agentId,
          role,
          state: "IDLE",
          deskId,
          load: 0,
          lastHeartbeatAt: Date.now(),
          health: "ok",
        });
      });
    },

    initAgentsBatch: (agents) => {
      set((state) => {
        for (const { agentId, role, deskId } of agents) {
          state.agents.set(agentId, {
            agentId,
            role,
            state: "IDLE",
            deskId,
            load: 0,
            lastHeartbeatAt: Date.now(),
            health: "ok",
          });
        }
      });
    },

    applyPerceivedEvent: (event: PerceivedEvent) => {
      set((state) => {
        // 更新涉及的 Agent 投影状态
        const newState = KIND_TO_STATE[event.kind] ?? "IDLE";

        for (const actorId of event.actors) {
          const agent = state.agents.get(actorId);
          if (!agent) continue;

          agent.state = newState;

          if (event.kind === "CALL_TOOL") {
            agent.tool = event.summary;
          } else {
            agent.tool = undefined;
          }

          if (event.kind === "BLOCK") {
            agent.health = "error";
          } else if (event.kind === "RECOVER") {
            agent.health = "ok";
          }

          agent.taskSummary = event.summary;
        }

        // 追加叙事日志
        if (event.summary && event.kind !== "POLL_HEARTBEAT") {
          state.narrativeLogs.push({
            ts: event.startTs,
            text: event.summary,
            level: event.level,
            kind: event.kind,
          });
          if (state.narrativeLogs.length > MAX_NARRATIVE_LOGS) {
            state.narrativeLogs.splice(0, state.narrativeLogs.length - MAX_NARRATIVE_LOGS);
          }
        }

        // 更新场景区域
        if (event.kind === "BROADCAST_CRON") {
          state.sceneArea.cronTasks.push({
            time: new Date(event.startTs).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            name: event.summary,
            status: "running",
          });
          if (state.sceneArea.cronTasks.length > 5) {
            state.sceneArea.cronTasks.shift();
          }
        }

        if (event.kind === "ARRIVE" || event.kind === "DISPATCH") {
          const streamLine = state.sceneArea.gatewayStream.find((l) => l.label === "Event Bus");
          if (streamLine) {
            streamLine.detail = event.summary.slice(0, 30);
            streamLine.active = true;
          }
        }
      });
    },

    resetAgent: (agentId: string) => {
      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent) return;
        agent.state = "IDLE";
        agent.tool = undefined;
        agent.taskSummary = undefined;
        agent.sessionId = undefined;
      });
    },

    getSnapshot: () => {
      const state = get();
      return {
        agents: new Map(state.agents),
        narrativeLogs: [...state.narrativeLogs],
        sceneArea: { ...state.sceneArea },
      };
    },
  })),
);
