import type { AgentEventPayload } from "@/gateway/types";
import { classifyEvent } from "./event-classifier";
import {
  AGGREGATE_WINDOW_MAX,
  AGGREGATE_WINDOW_MIN,
  DISPLAY_PRIORITY,
  EventLevel,
  HOLD_TIMES,
  BLOCK_HOLD_MS,
  RECOVER_HOLD_MS,
  type PerceivedEvent,
  type PerceivedKind,
} from "./types";

// --- 聚合窗口内部结构 ---

interface AggregationWindow {
  key: string;
  events: AgentEventPayload[];
  levels: EventLevel[];
  openedAt: number;
  deadline: number;
  timer: ReturnType<typeof setTimeout> | null;
}

type FlushCallback = (event: PerceivedEvent) => void;

let idCounter = 0;

function nextId(): string {
  return `pe-${Date.now()}-${++idCounter}`;
}

/**
 * 滑动窗口事件聚合器。
 *
 * 算法：
 * 1. 事件到达后计算 aggregation key（sessionKey > agentId > runId）
 * 2. 如果同 key 窗口已打开且未过期，追加事件并延长窗口（最大 800ms）
 * 3. 窗口关闭后，聚合为一个 PerceivedEvent
 */
export class EventAggregator {
  private windows = new Map<string, AggregationWindow>();
  private flushCallback: FlushCallback | null = null;

  onFlush(cb: FlushCallback): void {
    this.flushCallback = cb;
  }

  push(event: AgentEventPayload): void {
    const key = this.resolveKey(event);
    const level = classifyEvent(event);

    if (level === EventLevel.L0) {
      // L0 噪声不进入聚合窗口，直接丢弃（不上屏）
      return;
    }

    const now = Date.now();
    const existing = this.windows.get(key);

    if (existing && now < existing.deadline) {
      existing.events.push(event);
      existing.levels.push(level);
      // 延长窗口，但不超过 MAX
      const newDeadline = Math.min(existing.openedAt + AGGREGATE_WINDOW_MAX, now + AGGREGATE_WINDOW_MIN);
      if (newDeadline > existing.deadline) {
        existing.deadline = newDeadline;
        if (existing.timer !== null) {
          clearTimeout(existing.timer);
        }
        existing.timer = setTimeout(() => this.closeWindow(key), newDeadline - now);
      }
    } else {
      // 新窗口
      if (existing?.timer !== null && existing) {
        clearTimeout(existing.timer);
      }
      const deadline = now + AGGREGATE_WINDOW_MIN;
      const win: AggregationWindow = {
        key,
        events: [event],
        levels: [level],
        openedAt: now,
        deadline,
        timer: setTimeout(() => this.closeWindow(key), AGGREGATE_WINDOW_MIN),
      };
      this.windows.set(key, win);
    }
  }

  private closeWindow(key: string): void {
    const win = this.windows.get(key);
    if (!win) return;
    this.windows.delete(key);
    win.timer = null;

    const perceived = this.aggregate(win);
    this.flushCallback?.(perceived);
  }

  private aggregate(win: AggregationWindow): PerceivedEvent {
    const maxLevel = Math.max(...win.levels) as EventLevel;
    const kind = this.resolveKind(win.events, maxLevel);
    const actors = this.resolveActors(win.events);
    const area = this.resolveArea(kind);
    const holdMs = this.resolveHoldMs(kind, maxLevel);

    return {
      id: nextId(),
      startTs: win.events[0].ts,
      endTs: win.events[win.events.length - 1].ts,
      kind,
      level: maxLevel,
      actors,
      area,
      summary: "", // 由 NarrativeGenerator 填充
      displayPriority: DISPLAY_PRIORITY[maxLevel],
      holdMs,
      debugRefs: win.events.map((e) => `${e.runId}:${e.seq}`),
    };
  }

  /**
   * 根据聚合窗口内事件组合判定行为类型（kind）。
   * 优先级：error > sub-agent spawn > tool > lifecycle > assistant
   */
  private resolveKind(events: AgentEventPayload[], maxLevel: EventLevel): PerceivedKind {
    const hasError = events.some((e) => e.stream === "error");
    if (hasError) {
      const hasRecovery = events.some(
        (e) => e.stream === "lifecycle" && e.data.phase === "start",
      );
      return hasRecovery ? "RECOVER" : "BLOCK";
    }

    const hasSubAgentSpawn = events.some(
      (e) => e.stream === "lifecycle" && e.data.phase === "start" && Boolean(e.data.isSubAgent),
    );
    if (hasSubAgentSpawn) return "SPAWN_SUBAGENT";

    const hasExternalTrigger = events.some(
      (e) =>
        e.stream === "lifecycle" &&
        e.data.phase === "start" &&
        (e.data.trigger === "external" || e.data.trigger === "message"),
    );
    if (hasExternalTrigger) return "ARRIVE";

    const hasCronTrigger = events.some(
      (e) => e.stream === "lifecycle" && e.data.phase === "start" && e.data.trigger === "cron",
    );
    if (hasCronTrigger) return "BROADCAST_CRON";

    const toolStart = events.find((e) => e.stream === "tool" && e.data.phase === "start");
    if (toolStart) return "CALL_TOOL";

    const toolEnd = events.find((e) => e.stream === "tool" && e.data.phase !== "start");
    if (toolEnd) return "WAIT";

    const lifecycleEnd = events.find(
      (e) => e.stream === "lifecycle" && e.data.phase === "end",
    );
    if (lifecycleEnd) return "RETURN";

    const lifecycleStart = events.find(
      (e) => e.stream === "lifecycle" && e.data.phase === "start",
    );
    if (lifecycleStart) return "DISPATCH";

    const assistant = events.find((e) => e.stream === "assistant");
    if (assistant) return "FOCUS";

    if (maxLevel <= EventLevel.L1) return "POLL_HEARTBEAT";

    return "ACK";
  }

  private resolveActors(events: AgentEventPayload[]): string[] {
    const actors = new Set<string>();
    for (const e of events) {
      if (e.sessionKey) {
        const parts = e.sessionKey.split(":");
        if (parts.length >= 2) {
          actors.add(parts[1]);
        }
      }
      if (typeof e.data.agentId === "string") {
        actors.add(e.data.agentId);
      }
    }
    return Array.from(actors);
  }

  private resolveArea(kind: PerceivedKind): string {
    switch (kind) {
      case "ARRIVE":
      case "DISPATCH":
        return "gateway";
      case "BROADCAST_CRON":
        return "cron";
      case "SPAWN_SUBAGENT":
      case "COLLAB":
        return "project";
      case "BLOCK":
      case "RECOVER":
        return "ops";
      default:
        return "staff";
    }
  }

  private resolveHoldMs(kind: PerceivedKind, level: EventLevel): number {
    if (kind === "BLOCK") return BLOCK_HOLD_MS;
    if (kind === "RECOVER") return RECOVER_HOLD_MS;
    return HOLD_TIMES[level];
  }

  private resolveKey(event: AgentEventPayload): string {
    if (event.sessionKey) return `session:${event.sessionKey}`;
    return `run:${event.runId}`;
  }

  destroy(): void {
    for (const win of this.windows.values()) {
      if (win.timer !== null) clearTimeout(win.timer);
    }
    this.windows.clear();
    this.flushCallback = null;
  }
}
