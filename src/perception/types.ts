// Perception Layer 类型定义
// 将毫秒级 Gateway 事件转换为秒级人类可感知的组织行为

// --- 事件分级 ---

export enum EventLevel {
  /** 高频噪声（presence、内部 ack）— 仅更新内部状态，不上屏 */
  L0 = 0,
  /** 轻事件（heartbeat poll、短 tool ack）— 工位灯/图标变化 */
  L1 = 1,
  /** 短任务（接单、短分析）— 工位层动作，不跨区 */
  L2 = 2,
  /** 中任务（协作、工具调用等待）— 允许跨区移动 */
  L3 = 3,
  /** 重要事件（新客户、失败、cron 主任务、sub-agent 拉起）— 强叙事 */
  L4 = 4,
}

// --- 感知行为类型 ---

export type PerceivedKind =
  | "ARRIVE"
  | "DISPATCH"
  | "ACK"
  | "FOCUS"
  | "CALL_TOOL"
  | "WAIT"
  | "SPAWN_SUBAGENT"
  | "COLLAB"
  | "RETURN"
  | "BROADCAST_CRON"
  | "POLL_HEARTBEAT"
  | "BLOCK"
  | "RECOVER";

// --- 感知事件（聚合后输出） ---

export interface PerceivedEvent {
  id: string;
  startTs: number;
  endTs: number;
  kind: PerceivedKind;
  level: EventLevel;
  actors: string[];
  area: string;
  summary: string;
  displayPriority: number;
  holdMs: number;
  debugRefs: string[];
}

// --- Agent 投影状态 ---

export type PerceivedAgentState =
  | "IDLE"
  | "INCOMING"
  | "ACK"
  | "WORKING"
  | "TOOL_CALL"
  | "WAITING"
  | "COLLABORATING"
  | "RETURNING"
  | "DONE"
  | "BLOCKED"
  | "RECOVERED";

export interface AgentProjection {
  agentId: string;
  role: string;
  state: PerceivedAgentState;
  deskId: string;
  sessionId?: string;
  taskSummary?: string;
  tool?: string;
  load: number;
  lastHeartbeatAt: number;
  health: "ok" | "warn" | "error";
}

// --- 叙事日志 ---

export interface NarrativeLog {
  ts: number;
  text: string;
  level: EventLevel;
  kind: PerceivedKind;
}

// --- 场景区域状态 ---

export interface GatewayStreamLine {
  label: string;
  detail: string;
  active: boolean;
}

export interface SceneAreaState {
  gatewayStream: GatewayStreamLine[];
  cronTasks: Array<{ time: string; name: string; status: string }>;
  memoryItems: Array<{ text: string; tag: string }>;
  projectTasks: Array<{ title: string; subtitle: string }>;
  opsRules: Array<{ text: string; tag: string }>;
}

// --- 时间策略常量 ---

export const HOLD_TIMES: Record<EventLevel, number> = {
  [EventLevel.L0]: 0,
  [EventLevel.L1]: 800,
  [EventLevel.L2]: 1500,
  [EventLevel.L3]: 2500,
  [EventLevel.L4]: 4000,
};

/** 异常事件 holdMs 放大倍数 */
export const BLOCK_HOLD_MULTIPLIER = 1.5;
/** 阻塞异常的固定 holdMs */
export const BLOCK_HOLD_MS = 6000;
/** 重大恢复的固定 holdMs */
export const RECOVER_HOLD_MS = 3000;

// --- 聚合窗口常量 ---

/** 聚合窗口初始大小（ms） */
export const AGGREGATE_WINDOW_MIN = 300;
/** 聚合窗口最大大小（ms） */
export const AGGREGATE_WINDOW_MAX = 800;

// --- 叙事日志上限 ---

export const MAX_NARRATIVE_LOGS = 7;

// --- 分级规则用到的事件 display priority 映射 ---

export const DISPLAY_PRIORITY: Record<EventLevel, number> = {
  [EventLevel.L0]: 1,
  [EventLevel.L1]: 3,
  [EventLevel.L2]: 5,
  [EventLevel.L3]: 7,
  [EventLevel.L4]: 10,
};
