import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldController } from "../hold-controller";
import { EventLevel, type PerceivedEvent } from "../types";

function makePerceived(
  actors: string[] = ["agent1"],
  holdMs = 1500,
  kind: PerceivedEvent["kind"] = "DISPATCH",
): PerceivedEvent {
  return {
    id: `pe-${Math.random()}`,
    startTs: Date.now(),
    endTs: Date.now(),
    kind,
    level: EventLevel.L2,
    actors,
    area: "staff",
    summary: "test",
    displayPriority: 5,
    holdMs,
    debugRefs: [],
  };
}

describe("HoldController", () => {
  let controller: HoldController;
  let emitted: PerceivedEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new HoldController();
    emitted = [];
    controller.onEmit((e) => emitted.push(e));
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  it("emits first event immediately", () => {
    const event = makePerceived(["agent1"], 1500);
    controller.submit(event);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe(event.id);
  });

  it("queues events during holdMs period", () => {
    controller.submit(makePerceived(["agent1"], 1500, "DISPATCH"));
    controller.submit(makePerceived(["agent1"], 1500, "FOCUS"));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].kind).toBe("DISPATCH");
  });

  it("processes queued event after holdMs expires", () => {
    controller.submit(makePerceived(["agent1"], 1500, "DISPATCH"));
    controller.submit(makePerceived(["agent1"], 1500, "FOCUS"));

    vi.advanceTimersByTime(1600);

    expect(emitted).toHaveLength(2);
    expect(emitted[1].kind).toBe("FOCUS");
  });

  it("processes queue FIFO", async () => {
    controller.submit(makePerceived(["agent1"], 500, "DISPATCH"));
    controller.submit(makePerceived(["agent1"], 500, "FOCUS"));
    controller.submit(makePerceived(["agent1"], 500, "CALL_TOOL"));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].kind).toBe("DISPATCH");

    await vi.advanceTimersByTimeAsync(510);
    expect(emitted).toHaveLength(2);
    expect(emitted[1].kind).toBe("FOCUS");

    await vi.advanceTimersByTimeAsync(510);
    expect(emitted).toHaveLength(3);
    expect(emitted[2].kind).toBe("CALL_TOOL");
  });

  it("handles different agents independently", () => {
    controller.submit(makePerceived(["agent1"], 1500, "DISPATCH"));
    controller.submit(makePerceived(["agent2"], 1500, "FOCUS"));

    expect(emitted).toHaveLength(2);
  });

  it("BLOCK events hold for longer (6000ms)", () => {
    controller.submit(makePerceived(["agent1"], 6000, "BLOCK"));
    controller.submit(makePerceived(["agent1"], 1500, "DISPATCH"));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].kind).toBe("BLOCK");

    vi.advanceTimersByTime(4000);
    expect(emitted).toHaveLength(1);

    vi.advanceTimersByTime(2100);
    expect(emitted).toHaveLength(2);
    expect(emitted[1].kind).toBe("DISPATCH");
  });

  it("cleans up on destroy", () => {
    controller.submit(makePerceived(["agent1"], 1500));
    controller.submit(makePerceived(["agent1"], 1500));
    controller.destroy();

    vi.advanceTimersByTime(5000);
    expect(emitted).toHaveLength(1);
  });

  it("emits zero-holdMs events without blocking slot", () => {
    controller.submit(makePerceived(["agent1"], 0, "POLL_HEARTBEAT"));
    controller.submit(makePerceived(["agent1"], 1500, "DISPATCH"));

    expect(emitted).toHaveLength(2);
  });
});
