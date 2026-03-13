import type { PerceivedEvent, PerceivedKind } from "./types";

type TemplateContext = Record<string, string>;
type TemplateFn = (actors: string[], ctx: TemplateContext) => string;

const NARRATIVE_TEMPLATES: Record<PerceivedKind, TemplateFn> = {
  ARRIVE: (actors) =>
    `客户消息到达，Gateway 完成分发，${actors[0] ?? "Agent"} 开始接单。`,

  DISPATCH: (actors) =>
    `${actors[0] ?? "Agent"} 接到主线任务，开始处理。`,

  ACK: (actors) =>
    `${actors[0] ?? "Agent"} 确认接单。`,

  FOCUS: (actors) =>
    `${actors[0] ?? "Agent"} 专注处理中。`,

  CALL_TOOL: (actors, ctx) =>
    `${actors[0] ?? "Agent"} 调用 ${ctx.tool ?? "工具"} 工具。`,

  WAIT: (actors) =>
    `${actors[0] ?? "Agent"} 等待外部返回。`,

  SPAWN_SUBAGENT: () =>
    "临时协作者被拉入项目室。",

  COLLAB: (actors) =>
    `${actors.join("、") || "多个 Agent"} 进入协作模式。`,

  RETURN: (actors) =>
    `${actors[0] ?? "Agent"} 完成处理，结果回到主线。`,

  BROADCAST_CRON: (_actors, ctx) =>
    `Cron 广播触发：${ctx.taskName ?? "定时任务"}。`,

  POLL_HEARTBEAT: () =>
    "Heartbeat 巡检扫过工位。",

  BLOCK: (actors, ctx) =>
    `${actors[0] ?? "Agent"} 进入阻塞态${ctx.reason ? `：${ctx.reason}` : "。"}`,

  RECOVER: (actors) =>
    `${actors[0] ?? "Agent"} 从阻塞中恢复。`,
};

const FALLBACK_TEXT = "系统处理中...";

/**
 * 为 PerceivedEvent 生成中文叙事句。
 *
 * 根据 kind 选择模板，将 actors 和 context 插值后返回可读文本。
 * 未匹配的 kind 使用通用降级文本。
 */
export function generateNarrative(event: PerceivedEvent): string {
  const template = NARRATIVE_TEMPLATES[event.kind];
  if (!template) return FALLBACK_TEXT;

  const ctx = extractContext(event);
  return template(event.actors, ctx);
}

function extractContext(event: PerceivedEvent): TemplateContext {
  const ctx: TemplateContext = {};

  // 从 debugRefs 中无法直接提取工具名和任务名——
  // 这些信息需要在聚合阶段就保存到 PerceivedEvent 上。
  // 目前使用 area 作为粗略推断。
  if (event.area === "cron") {
    ctx.taskName = "定时任务";
  }

  return ctx;
}
