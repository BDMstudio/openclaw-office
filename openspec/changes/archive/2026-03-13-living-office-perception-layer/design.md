## Context

当前事件处理管道：

```
WebSocket → GatewayWsClient → EventThrottle → processAgentEvent(office-store) → React 渲染
```

`EventThrottle` 只做了两件事：高优先级事件（error、lifecycle start/end）立即推送；其他事件按 `requestAnimationFrame` 批量推送。它没有：
- 关联事件聚合（多个事件合为一个叙事）
- 事件分级（区分噪声和重要事件）
- 最短展示时间控制
- 叙事化文本生成

产品蓝图要求建立 Perception Layer，把毫秒级系统事件"翻译"成秒级人类可感知的组织行为。

## Goals / Non-Goals

**Goals:**

- 构建可插拔的 Perception Engine，作为 Gateway 事件到 UI 渲染之间的中间层
- 实现 L0-L4 五级事件分级，每级有不同的渲染策略和最短展示时间
- 实现 300-800ms 时间窗口的关联事件聚合
- 生成中文叙事句，让事件日志从"技术噪声"变成"组织行为描述"
- 维护 Agent 投影状态，供场景层直接消费
- 确保新管道与旧管道可以并存（旧渲染路径继续使用 EventThrottle）

**Non-Goals:**

- 不做事件回放（replay）系统（V3 考虑）
- 不做事件持久化/存储
- 不做 Raw Event Inspector 调试面板（由子提案4 HUD 负责）
- 不修改 Gateway WS 协议或服务端逻辑

## Decisions

### D1: 架构分层——三个独立模块

```
src/perception/
├── event-classifier.ts     # 事件分级器（L0-L4）
├── event-aggregator.ts     # 时间窗口聚合器
├── narrative-generator.ts  # 叙事文本生成器
├── hold-controller.ts      # 感知节流控制器（最短展示时间）
├── perception-engine.ts    # 总入口，组合上述模块
├── projection-store.ts     # Agent 投影状态维护
└── types.ts                # PerceivedEvent、EventLevel、AgentProjection 等类型
```

**理由**：每个关注点独立可测、可替换。分级规则变更只改 classifier，叙事模板变更只改 generator。

### D2: 事件分级策略

| 级别 | 事件类型 | 渲染策略 | 最短展示时间 |
|------|---------|---------|------------|
| L0 | 高频 presence、内部 ack、重复 health | 仅更新内部状态，不上屏 | 0 |
| L1 | heartbeat poll、短 tool ack | 工位灯、状态圈、图标变化 | 0.8s |
| L2 | 接单、短分析、上下文写入 | 工位层动作，不跨区 | 1.5s |
| L3 | 协作、工具调用等待、排障 | 允许跨区移动 | 2.5s |
| L4 | 新客户进入、失败重试、cron 主任务、sub-agent 拉起 | 强叙事、保留更久、写日志 | 4s |

分级依据：`stream` 类型 + `data` 字段组合判定。例如 `lifecycle.start` 是 L2，`lifecycle.start` + `data.isSubAgent=true` 升级为 L4。

### D3: 时间窗口聚合

**算法**：滑动窗口，窗口大小 300-800ms（根据事件密度自适应）。

1. 第一个事件到达，开启窗口（初始 300ms）
2. 窗口内后续事件如果与窗口内已有事件"关联"（同 sessionKey 或同 agentId），加入窗口并延长至 max 800ms
3. 窗口关闭后，聚合为一个 `PerceivedEvent`，计算最高级别，生成叙事文本

**关联判定**：同一 `sessionKey`、同一 `agentId`、或 `runId` 关联链上的事件。

### D4: 叙事生成——模板 + 组合

叙事生成器使用预定义的中文模板，根据 `PerceivedEvent.kind`（行为 DSL）生成可读文本：

```typescript
const NARRATIVE_TEMPLATES: Record<PerceivedKind, (actors: string[], context: Record<string, string>) => string> = {
  ARRIVE: (actors, ctx) => `客户消息到达，Gateway 完成分发，${actors[0]} 开始接单。`,
  DISPATCH: (actors, ctx) => `${actors[0]} 接到主线任务，开始处理。`,
  BROADCAST_CRON: (actors, ctx) => `Cron 广播触发：${ctx.taskName}。`,
  BLOCK: (actors, ctx) => `${actors[0]} 等待外部返回，进入阻塞态。`,
  // ...
}
```

**理由**：V1 阶段用模板足够，未来可替换为 LLM 生成更自然的叙事。

### D5: 感知节流——Hold 队列

`HoldController` 维护一个展示队列：

1. `PerceivedEvent` 进入队列
2. 根据 `level` 计算 `holdMs`（最短展示时间）
3. 当前展示的事件在 holdMs 到期前，不允许被新事件覆盖
4. 异常事件（BLOCK/ERROR）的 holdMs 是正常事件的 2-3 倍（"异常要比正常更慢"）

```
正常完成: holdMs = 1.5s
阻塞异常: holdMs = 6s
重大恢复: holdMs = 3s
```

### D6: 投影状态存储

`ProjectionStore` 维护每个 Agent 的当前投影状态：

```typescript
interface AgentProjection {
  agentId: string;
  role: string;
  state: PerceivedAgentState;  // IDLE/INCOMING/ACK/WORKING/TOOL_CALL/WAITING/COLLABORATING/RETURNING/DONE/BLOCKED/RECOVERED
  deskId: string;
  sessionId?: string;
  taskSummary?: string;
  tool?: string;
  load: number;
  lastHeartbeatAt: number;
  health: "ok" | "warn" | "error";
}
```

场景层直接订阅 ProjectionStore 读取渲染数据，不再直接访问 office-store 的 `agents` Map。

### D7: 与现有系统的集成方式

新管道：`WsAdapter → PerceptionEngine.ingest() → PerceivedEvent → LivingOfficeView`

旧管道保持不变：`WsAdapter → EventThrottle → processAgentEvent → FloorPlan/Scene3D`

两条管道并行运行，由各自的视图组件消费。`useGatewayConnection` hook 同时向两条管道分发事件。

## Risks / Trade-offs

- **[延迟增加] 聚合窗口带来 300-800ms 额外延迟** → 这是设计意图——让人类能感知到因果关系。如果用户需要实时数据，可切换到 Raw Event Inspector
- **[叙事模板硬编码] 模板无法覆盖所有事件组合** → V1 对未匹配的组合使用通用模板（"系统处理事件中..."），后续迭代补充
- **[状态同步] 两条管道并行可能导致状态不一致** → ProjectionStore 作为 Living Office 的唯一状态源，不与 office-store 共享可变状态
- **[分级误判] 事件分级规则可能需要多次调优** → classifier 规则集中管理，支持热更新（修改规则文件即可，不需要重构管道）
