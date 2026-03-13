import { describe, expect, it } from "vitest";
import type { AgentEventPayload } from "@/gateway/types";
import { classifyEvent } from "../event-classifier";
import { EventLevel } from "../types";

function makeEvent(
  stream: AgentEventPayload["stream"],
  data: Record<string, unknown> = {},
): AgentEventPayload {
  return { runId: "r1", seq: 1, stream, ts: Date.now(), data };
}

describe("classifyEvent", () => {
  describe("error stream", () => {
    it("classifies all error events as L4", () => {
      expect(classifyEvent(makeEvent("error", { message: "boom" }))).toBe(EventLevel.L4);
    });
  });

  describe("lifecycle stream", () => {
    it("classifies lifecycle.start as L2 by default", () => {
      expect(classifyEvent(makeEvent("lifecycle", { phase: "start" }))).toBe(EventLevel.L2);
    });

    it("upgrades lifecycle.start with external trigger to L4", () => {
      expect(
        classifyEvent(makeEvent("lifecycle", { phase: "start", trigger: "external" })),
      ).toBe(EventLevel.L4);
    });

    it("upgrades lifecycle.start with message trigger to L4", () => {
      expect(
        classifyEvent(makeEvent("lifecycle", { phase: "start", trigger: "message" })),
      ).toBe(EventLevel.L4);
    });

    it("upgrades lifecycle.start with isSubAgent to L4", () => {
      expect(
        classifyEvent(makeEvent("lifecycle", { phase: "start", isSubAgent: true })),
      ).toBe(EventLevel.L4);
    });

    it("classifies lifecycle.end as L2", () => {
      expect(classifyEvent(makeEvent("lifecycle", { phase: "end" }))).toBe(EventLevel.L2);
    });

    it("classifies lifecycle.thinking as L1", () => {
      expect(classifyEvent(makeEvent("lifecycle", { phase: "thinking" }))).toBe(EventLevel.L1);
    });

    it("classifies lifecycle.fallback as L4", () => {
      expect(classifyEvent(makeEvent("lifecycle", { phase: "fallback" }))).toBe(EventLevel.L4);
    });

    it("classifies unknown lifecycle phase as L1", () => {
      expect(classifyEvent(makeEvent("lifecycle", { phase: "unknown-phase" }))).toBe(EventLevel.L1);
    });
  });

  describe("tool stream", () => {
    it("classifies tool.start as L3", () => {
      expect(
        classifyEvent(makeEvent("tool", { phase: "start", name: "web_search" })),
      ).toBe(EventLevel.L3);
    });

    it("classifies tool.end as L1", () => {
      expect(
        classifyEvent(makeEvent("tool", { phase: "end", name: "web_search" })),
      ).toBe(EventLevel.L1);
    });
  });

  describe("assistant stream", () => {
    it("classifies short text as L1", () => {
      expect(classifyEvent(makeEvent("assistant", { text: "ok" }))).toBe(EventLevel.L1);
    });

    it("classifies medium text as L2", () => {
      const text = "This is a medium-length response text.";
      expect(classifyEvent(makeEvent("assistant", { text }))).toBe(EventLevel.L2);
    });

    it("classifies long text as L3", () => {
      const text = "A".repeat(120);
      expect(classifyEvent(makeEvent("assistant", { text }))).toBe(EventLevel.L3);
    });

    it("classifies empty text as L1", () => {
      expect(classifyEvent(makeEvent("assistant", {}))).toBe(EventLevel.L1);
    });
  });
});
