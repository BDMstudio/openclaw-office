import { beforeEach, describe, expect, it } from "vitest";
import { useProjectionStore } from "../projection-store";
import { EventLevel, type PerceivedEvent } from "../types";

function makePerceived(
  kind: PerceivedEvent["kind"],
  actors: string[] = ["agent1"],
  overrides: Partial<PerceivedEvent> = {},
): PerceivedEvent {
  return {
    id: "pe-1",
    startTs: Date.now(),
    endTs: Date.now(),
    kind,
    level: EventLevel.L2,
    actors,
    area: "staff",
    summary: "测试叙事",
    displayPriority: 5,
    holdMs: 1500,
    debugRefs: [],
    ...overrides,
  };
}

describe("ProjectionStore", () => {
  beforeEach(() => {
    useProjectionStore.setState({
      agents: new Map(),
      narrativeLogs: [],
      sceneArea: {
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
      },
    });
  });

  describe("initAgent", () => {
    it("creates agent projection with IDLE state", () => {
      useProjectionStore.getState().initAgent("agent1", "orchestrator", "desk-gm");
      const agent = useProjectionStore.getState().agents.get("agent1");

      expect(agent).toBeDefined();
      expect(agent?.state).toBe("IDLE");
      expect(agent?.health).toBe("ok");
      expect(agent?.load).toBe(0);
      expect(agent?.deskId).toBe("desk-gm");
    });
  });

  describe("initAgentsBatch", () => {
    it("creates multiple agent projections", () => {
      useProjectionStore.getState().initAgentsBatch([
        { agentId: "a1", role: "orchestrator", deskId: "d1" },
        { agentId: "a2", role: "sales", deskId: "d2" },
      ]);

      expect(useProjectionStore.getState().agents.size).toBe(2);
    });
  });

  describe("applyPerceivedEvent", () => {
    it("updates agent state based on event kind", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("DISPATCH", ["agent1"]));

      const agent = useProjectionStore.getState().agents.get("agent1");
      expect(agent?.state).toBe("WORKING");
    });

    it("sets BLOCKED state and error health on BLOCK event", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("BLOCK", ["agent1"]));

      const agent = useProjectionStore.getState().agents.get("agent1");
      expect(agent?.state).toBe("BLOCKED");
      expect(agent?.health).toBe("error");
    });

    it("recovers health on RECOVER event", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("BLOCK", ["agent1"]));
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("RECOVER", ["agent1"]));

      const agent = useProjectionStore.getState().agents.get("agent1");
      expect(agent?.state).toBe("RECOVERED");
      expect(agent?.health).toBe("ok");
    });

    it("sets tool info on CALL_TOOL event", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore
        .getState()
        .applyPerceivedEvent(makePerceived("CALL_TOOL", ["agent1"], { summary: "web_search" }));

      const agent = useProjectionStore.getState().agents.get("agent1");
      expect(agent?.state).toBe("TOOL_CALL");
      expect(agent?.tool).toBe("web_search");
    });

    it("appends narrative log", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("DISPATCH", ["agent1"]));

      expect(useProjectionStore.getState().narrativeLogs).toHaveLength(1);
      expect(useProjectionStore.getState().narrativeLogs[0].text).toBe("测试叙事");
    });

    it("does not append POLL_HEARTBEAT to narrative log", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("POLL_HEARTBEAT", ["agent1"]));

      expect(useProjectionStore.getState().narrativeLogs).toHaveLength(0);
    });

    it("enforces max narrative logs (FIFO)", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");

      for (let i = 0; i < 10; i++) {
        useProjectionStore.getState().applyPerceivedEvent(
          makePerceived("DISPATCH", ["agent1"], { summary: `叙事 ${i}` }),
        );
      }

      const logs = useProjectionStore.getState().narrativeLogs;
      expect(logs.length).toBeLessThanOrEqual(7);
      expect(logs[0].text).toBe("叙事 3");
      expect(logs[logs.length - 1].text).toBe("叙事 9");
    });

    it("updates cron tasks on BROADCAST_CRON", () => {
      useProjectionStore.getState().applyPerceivedEvent(
        makePerceived("BROADCAST_CRON", [], { area: "cron", summary: "每日报告生成" }),
      );

      expect(useProjectionStore.getState().sceneArea.cronTasks).toHaveLength(1);
      expect(useProjectionStore.getState().sceneArea.cronTasks[0].name).toBe("每日报告生成");
    });
  });

  describe("resetAgent", () => {
    it("resets agent to IDLE state", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      useProjectionStore.getState().applyPerceivedEvent(makePerceived("DISPATCH", ["agent1"]));
      useProjectionStore.getState().resetAgent("agent1");

      const agent = useProjectionStore.getState().agents.get("agent1");
      expect(agent?.state).toBe("IDLE");
      expect(agent?.tool).toBeUndefined();
      expect(agent?.taskSummary).toBeUndefined();
    });
  });

  describe("getSnapshot", () => {
    it("returns a copy of current state", () => {
      useProjectionStore.getState().initAgent("agent1", "sales", "desk-1");
      const snapshot = useProjectionStore.getState().getSnapshot();

      expect(snapshot.agents.size).toBe(1);
      expect(snapshot.narrativeLogs).toBeInstanceOf(Array);

      // Verify it's a copy, not a reference
      snapshot.agents.delete("agent1");
      expect(useProjectionStore.getState().agents.size).toBe(1);
    });
  });
});
