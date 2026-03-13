import { describe, expect, it } from "vitest";
import { generateNarrative } from "../narrative-generator";
import { EventLevel, type PerceivedEvent } from "../types";

function makePerceived(
  kind: PerceivedEvent["kind"],
  actors: string[] = ["Sales Agent"],
  area = "staff",
): PerceivedEvent {
  return {
    id: "pe-1",
    startTs: Date.now(),
    endTs: Date.now(),
    kind,
    level: EventLevel.L2,
    actors,
    area,
    summary: "",
    displayPriority: 5,
    holdMs: 1500,
    debugRefs: [],
  };
}

describe("generateNarrative", () => {
  it("generates ARRIVE narrative with actor name", () => {
    const text = generateNarrative(makePerceived("ARRIVE", ["Sales Agent"]));
    expect(text).toBe("客户消息到达，Gateway 完成分发，Sales Agent 开始接单。");
  });

  it("generates DISPATCH narrative", () => {
    const text = generateNarrative(makePerceived("DISPATCH", ["Ops Agent"]));
    expect(text).toBe("Ops Agent 接到主线任务，开始处理。");
  });

  it("generates ACK narrative", () => {
    const text = generateNarrative(makePerceived("ACK", ["GM"]));
    expect(text).toBe("GM 确认接单。");
  });

  it("generates FOCUS narrative", () => {
    const text = generateNarrative(makePerceived("FOCUS"));
    expect(text).toBe("Sales Agent 专注处理中。");
  });

  it("generates CALL_TOOL narrative", () => {
    const text = generateNarrative(makePerceived("CALL_TOOL"));
    expect(text).toContain("调用");
    expect(text).toContain("工具");
  });

  it("generates WAIT narrative", () => {
    const text = generateNarrative(makePerceived("WAIT"));
    expect(text).toBe("Sales Agent 等待外部返回。");
  });

  it("generates SPAWN_SUBAGENT narrative", () => {
    const text = generateNarrative(makePerceived("SPAWN_SUBAGENT"));
    expect(text).toBe("临时协作者被拉入项目室。");
  });

  it("generates COLLAB narrative with multiple actors", () => {
    const text = generateNarrative(makePerceived("COLLAB", ["Agent A", "Agent B"]));
    expect(text).toBe("Agent A、Agent B 进入协作模式。");
  });

  it("generates RETURN narrative", () => {
    const text = generateNarrative(makePerceived("RETURN"));
    expect(text).toBe("Sales Agent 完成处理，结果回到主线。");
  });

  it("generates BROADCAST_CRON narrative", () => {
    const text = generateNarrative(makePerceived("BROADCAST_CRON", [], "cron"));
    expect(text).toContain("Cron 广播触发");
  });

  it("generates POLL_HEARTBEAT narrative", () => {
    const text = generateNarrative(makePerceived("POLL_HEARTBEAT"));
    expect(text).toBe("Heartbeat 巡检扫过工位。");
  });

  it("generates BLOCK narrative", () => {
    const text = generateNarrative(makePerceived("BLOCK"));
    expect(text).toContain("进入阻塞态");
  });

  it("generates RECOVER narrative", () => {
    const text = generateNarrative(makePerceived("RECOVER"));
    expect(text).toBe("Sales Agent 从阻塞中恢复。");
  });

  it("uses default actor name when actors array is empty", () => {
    const text = generateNarrative(makePerceived("DISPATCH", []));
    expect(text).toBe("Agent 接到主线任务，开始处理。");
  });
});
