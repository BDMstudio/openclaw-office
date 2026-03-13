import type { AgentEventPayload } from "@/gateway/types";
import { EventLevel } from "./types";

/**
 * 将原始 Gateway 事件分类到 L0-L4 五个级别。
 *
 * 分级依据：stream 类型 + data 字段组合判定。
 * L0 = 噪声不上屏，L4 = 强叙事 + 长保留。
 */
export function classifyEvent(event: AgentEventPayload): EventLevel {
  switch (event.stream) {
    case "error":
      return EventLevel.L4;

    case "lifecycle":
      return classifyLifecycle(event);

    case "tool":
      return classifyTool(event);

    case "assistant":
      return classifyAssistant(event);

    default:
      return EventLevel.L0;
  }
}

function classifyLifecycle(event: AgentEventPayload): EventLevel {
  const phase = event.data.phase as string | undefined;
  const trigger = event.data.trigger as string | undefined;
  const isSubAgent = Boolean(event.data.isSubAgent);

  switch (phase) {
    case "start":
      if (isSubAgent) return EventLevel.L4;
      if (trigger === "external" || trigger === "message") return EventLevel.L4;
      return EventLevel.L2;

    case "end":
      return EventLevel.L2;

    case "thinking":
      return EventLevel.L1;

    case "fallback":
      return EventLevel.L4;

    default:
      return EventLevel.L1;
  }
}

function classifyTool(event: AgentEventPayload): EventLevel {
  const phase = event.data.phase as string | undefined;

  if (phase === "start") return EventLevel.L3;

  // tool end / ack — 较轻
  return EventLevel.L1;
}

function classifyAssistant(event: AgentEventPayload): EventLevel {
  const text = (event.data.text as string) ?? "";
  // 长文本回复是更有意义的事件
  if (text.length > 100) return EventLevel.L3;
  if (text.length > 20) return EventLevel.L2;
  return EventLevel.L1;
}
