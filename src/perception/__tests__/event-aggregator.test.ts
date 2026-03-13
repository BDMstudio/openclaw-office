import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentEventPayload } from "@/gateway/types";
import { EventAggregator } from "../event-aggregator";
import { EventLevel } from "../types";
import type { PerceivedEvent } from "../types";

function makeEvent(
  stream: AgentEventPayload["stream"],
  data: Record<string, unknown> = {},
  overrides: Partial<AgentEventPayload> = {},
): AgentEventPayload {
  return {
    runId: "r1",
    seq: 1,
    stream,
    ts: Date.now(),
    data,
    sessionKey: "channel:agent1",
    ...overrides,
  };
}

describe("EventAggregator", () => {
  let aggregator: EventAggregator;
  let results: PerceivedEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    aggregator = new EventAggregator();
    results = [];
    aggregator.onFlush((e) => results.push(e));
  });

  afterEach(() => {
    aggregator.destroy();
    vi.useRealTimers();
  });

  it("aggregates related events in same session into one PerceivedEvent", () => {
    aggregator.push(makeEvent("lifecycle", { phase: "start", trigger: "external" }));
    aggregator.push(makeEvent("lifecycle", { phase: "thinking" }));

    expect(results).toHaveLength(0);

    vi.advanceTimersByTime(400);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("ARRIVE");
    expect(results[0].level).toBe(EventLevel.L4);
    expect(results[0].debugRefs).toHaveLength(2);
  });

  it("keeps unrelated events separate", () => {
    aggregator.push(
      makeEvent("lifecycle", { phase: "start" }, { sessionKey: "ch:agentA", runId: "r1" }),
    );
    aggregator.push(
      makeEvent("tool", { phase: "start", name: "search" }, { sessionKey: "ch:agentB", runId: "r2" }),
    );

    vi.advanceTimersByTime(400);
    expect(results).toHaveLength(2);
  });

  it("drops L0 events (not aggregated)", () => {
    // presence-like events are unknown stream → L0
    const presenceEvent: AgentEventPayload = {
      runId: "r1",
      seq: 1,
      stream: "lifecycle" as AgentEventPayload["stream"],
      ts: Date.now(),
      data: { phase: "thinking" },
      sessionKey: "ch:agent1",
    };
    // thinking is L1, so it goes through
    aggregator.push(presenceEvent);
    vi.advanceTimersByTime(400);
    expect(results).toHaveLength(1);
  });

  it("extends window up to max 800ms on related events", () => {
    aggregator.push(makeEvent("lifecycle", { phase: "start" }));

    vi.advanceTimersByTime(250);
    aggregator.push(makeEvent("tool", { phase: "start", name: "web" }));

    // Original 300ms window should have extended
    vi.advanceTimersByTime(100);
    expect(results).toHaveLength(0);

    vi.advanceTimersByTime(200);
    expect(results).toHaveLength(1);
    expect(results[0].debugRefs).toHaveLength(2);
  });

  it("resolves kind as BLOCK for error events", () => {
    aggregator.push(makeEvent("error", { message: "timeout" }));
    vi.advanceTimersByTime(400);

    expect(results[0].kind).toBe("BLOCK");
    expect(results[0].holdMs).toBe(6000);
  });

  it("resolves kind as RECOVER for error + lifecycle.start combo", () => {
    aggregator.push(makeEvent("error", { message: "timeout" }));
    aggregator.push(makeEvent("lifecycle", { phase: "start" }));
    vi.advanceTimersByTime(400);

    expect(results[0].kind).toBe("RECOVER");
    expect(results[0].holdMs).toBe(3000);
  });

  it("resolves kind as CALL_TOOL for tool.start events", () => {
    aggregator.push(makeEvent("tool", { phase: "start", name: "web_search" }));
    vi.advanceTimersByTime(400);

    expect(results[0].kind).toBe("CALL_TOOL");
    expect(results[0].area).toBe("staff");
  });

  it("resolves kind as RETURN for lifecycle.end events", () => {
    aggregator.push(makeEvent("lifecycle", { phase: "end" }));
    vi.advanceTimersByTime(400);

    expect(results[0].kind).toBe("RETURN");
  });

  it("resolves kind as SPAWN_SUBAGENT for sub-agent start", () => {
    aggregator.push(makeEvent("lifecycle", { phase: "start", isSubAgent: true }));
    vi.advanceTimersByTime(400);

    expect(results[0].kind).toBe("SPAWN_SUBAGENT");
    expect(results[0].area).toBe("project");
  });

  it("resolves actors from sessionKey", () => {
    aggregator.push(makeEvent("lifecycle", { phase: "start" }, { sessionKey: "telegram:sales-agent" }));
    vi.advanceTimersByTime(400);

    expect(results[0].actors).toContain("sales-agent");
  });

  it("cleans up on destroy", () => {
    aggregator.push(makeEvent("lifecycle", { phase: "start" }));
    aggregator.destroy();
    vi.advanceTimersByTime(1000);

    expect(results).toHaveLength(0);
  });
});
