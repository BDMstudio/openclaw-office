import type { AgentEventPayload } from "@/gateway/types";
import { EventAggregator } from "./event-aggregator";
import { HoldController } from "./hold-controller";
import { generateNarrative } from "./narrative-generator";
import type { PerceivedEvent } from "./types";

type PerceivedCallback = (event: PerceivedEvent) => void;

/**
 * 感知引擎——整个 Perception Layer 的统一入口。
 *
 * 管道：ingest() → EventClassifier → EventAggregator → NarrativeGenerator → HoldController → emit
 *
 * classifier 内嵌于 aggregator（push 时自动分级），
 * narrative 在 aggregator flush 后填充 summary，
 * holdController 控制最短展示时间。
 */
export class PerceptionEngine {
  private aggregator: EventAggregator;
  private holdController: HoldController;
  private listeners: PerceivedCallback[] = [];

  constructor() {
    this.aggregator = new EventAggregator();
    this.holdController = new HoldController();

    this.aggregator.onFlush((event) => {
      const withNarrative: PerceivedEvent = {
        ...event,
        summary: generateNarrative(event),
      };
      this.holdController.submit(withNarrative);
    });

    this.holdController.onEmit((event) => {
      for (const cb of this.listeners) {
        cb(event);
      }
    });
  }

  /** 接收原始 Gateway 事件 */
  ingest(event: AgentEventPayload): void {
    this.aggregator.push(event);
  }

  /** 注册感知事件消费者 */
  onPerceived(callback: PerceivedCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  destroy(): void {
    this.aggregator.destroy();
    this.holdController.destroy();
    this.listeners.length = 0;
  }
}
