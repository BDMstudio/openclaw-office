import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentEventPayload } from "@/gateway/types";
import { PerceptionEngine } from "../perception-engine";
import { EventLevel, type PerceivedEvent } from "../types";

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
    sessionKey: "telegram:sales-agent",
    ...overrides,
  };
}

describe("PerceptionEngine", () => {
  let engine: PerceptionEngine;
  let perceived: PerceivedEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new PerceptionEngine();
    perceived = [];
    engine.onPerceived((e) => perceived.push(e));
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
  });

  it("processes a single event end-to-end", () => {
    engine.ingest(makeEvent("lifecycle", { phase: "start", trigger: "external" }));

    vi.advanceTimersByTime(400);

    expect(perceived).toHaveLength(1);
    expect(perceived[0].kind).toBe("ARRIVE");
    expect(perceived[0].level).toBe(EventLevel.L4);
    expect(perceived[0].summary).toContain("客户消息到达");
    expect(perceived[0].summary).toContain("sales-agent");
    expect(perceived[0].holdMs).toBe(4000);
  });

  it("aggregates related events before generating narrative", () => {
    engine.ingest(makeEvent("lifecycle", { phase: "start", trigger: "external" }));
    engine.ingest(makeEvent("lifecycle", { phase: "thinking" }));

    vi.advanceTimersByTime(400);

    expect(perceived).toHaveLength(1);
    expect(perceived[0].debugRefs).toHaveLength(2);
    expect(perceived[0].summary).toContain("客户消息到达");
  });

  it("handles error events with BLOCK kind and long hold", () => {
    engine.ingest(makeEvent("error", { message: "connection timeout" }));

    vi.advanceTimersByTime(400);

    expect(perceived).toHaveLength(1);
    expect(perceived[0].kind).toBe("BLOCK");
    expect(perceived[0].holdMs).toBe(6000);
    expect(perceived[0].summary).toContain("阻塞态");
  });

  it("respects hold controller timing between same-agent events", () => {
    engine.ingest(makeEvent("lifecycle", { phase: "start" }));
    vi.advanceTimersByTime(400);
    expect(perceived).toHaveLength(1);

    engine.ingest(makeEvent("tool", { phase: "start", name: "search" }));
    vi.advanceTimersByTime(400);

    // Second event should be queued due to hold
    // L2 hold is 1500ms, only 400ms passed since first emit
    expect(perceived).toHaveLength(1);

    // Advance past L2 holdMs
    vi.advanceTimersByTime(1200);
    expect(perceived).toHaveLength(2);
  });

  it("unsubscribe works", () => {
    const unsub = engine.onPerceived(() => {
      /* extra listener */
    });
    unsub();

    engine.ingest(makeEvent("lifecycle", { phase: "start" }));
    vi.advanceTimersByTime(400);

    expect(perceived).toHaveLength(1);
  });

  it("generates narrative for tool call events", () => {
    engine.ingest(makeEvent("tool", { phase: "start", name: "web_search" }));

    vi.advanceTimersByTime(400);

    expect(perceived).toHaveLength(1);
    expect(perceived[0].kind).toBe("CALL_TOOL");
    expect(perceived[0].summary).toContain("调用");
  });

  it("cleans up on destroy", () => {
    engine.ingest(makeEvent("lifecycle", { phase: "start" }));
    engine.destroy();

    vi.advanceTimersByTime(1000);
    expect(perceived).toHaveLength(0);
  });
});
