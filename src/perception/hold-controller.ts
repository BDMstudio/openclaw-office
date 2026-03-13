import type { PerceivedEvent } from "./types";

type EmitCallback = (event: PerceivedEvent) => void;

interface HoldSlot {
  current: PerceivedEvent;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  queue: PerceivedEvent[];
}

/**
 * 感知节流控制器。
 *
 * 按 Agent 维度管理展示队列：每个 Agent 同时只展示一个 PerceivedEvent，
 * holdMs 到期前新事件排队等待，不直接覆盖当前展示。
 */
export class HoldController {
  private slots = new Map<string, HoldSlot>();
  private emitCallback: EmitCallback | null = null;

  onEmit(cb: EmitCallback): void {
    this.emitCallback = cb;
  }

  /**
   * 提交一个感知事件到节流控制器。
   * 如果对应 Agent 当前没有展示中的事件，则立即发射。
   * 如果有展示中的事件且 holdMs 未到期，则排队等待。
   */
  submit(event: PerceivedEvent): void {
    const key = this.resolveKey(event);
    const existing = this.slots.get(key);

    if (!existing) {
      this.emitNow(key, event);
      return;
    }

    // holdMs 未到期，排队
    existing.queue.push(event);
  }

  private emitNow(key: string, event: PerceivedEvent): void {
    const holdMs = Math.max(event.holdMs, 0);

    this.emitCallback?.(event);

    if (holdMs === 0) {
      // L0 无 hold 时间，不占用 slot
      return;
    }

    const now = Date.now();
    const expiresAt = now + holdMs;

    const slot: HoldSlot = {
      current: event,
      expiresAt,
      timer: setTimeout(() => this.onSlotExpired(key), holdMs),
      queue: [],
    };

    this.slots.set(key, slot);
  }

  private onSlotExpired(key: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;

    const remaining = slot.queue;
    this.slots.delete(key);

    const next = remaining.shift();
    if (next) {
      this.emitNow(key, next);
      // Transfer remaining queue items to the newly created slot
      const newSlot = this.slots.get(key);
      if (newSlot) {
        newSlot.queue.push(...remaining);
      }
    }
  }

  /** 获取某个 Agent 当前的展示事件（调试用） */
  getCurrentForAgent(agentKey: string): PerceivedEvent | null {
    return this.slots.get(agentKey)?.current ?? null;
  }

  /** 获取某个 Agent 的队列长度（调试用） */
  getQueueLength(agentKey: string): number {
    return this.slots.get(agentKey)?.queue.length ?? 0;
  }

  private resolveKey(event: PerceivedEvent): string {
    // 使用第一个 actor 作为 key，没有 actor 时使用 area
    return event.actors[0] ?? event.area;
  }

  destroy(): void {
    for (const slot of this.slots.values()) {
      clearTimeout(slot.timer);
    }
    this.slots.clear();
    this.emitCallback = null;
  }
}
