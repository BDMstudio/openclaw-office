## ADDED Requirements

### Requirement: 事件分级器

系统 SHALL 提供 `EventClassifier` 模块，将 `AgentEventPayload` 分类到 L0-L4 五个级别。分级规则：

- **L0**：高频 presence.sync、重复 health 确认、内部 ack → 仅更新内部状态，不触发 UI 更新
- **L1**：heartbeat poll、短 tool ack（工具调用确认但非结果）→ 仅更新工位灯/状态圈
- **L2**：lifecycle.start（非 sub-agent）、assistant（短文本）、上下文写入 → 工位层动作
- **L3**：tool.call（有等待时间）、协作请求、排障介入 → 允许跨区移动
- **L4**：新 session（客户消息到达）、error/blocked、cron.fire、sub-agent spawn → 强叙事

#### Scenario: 高频 presence 事件降级
- **WHEN** 收到 `presence.sync` 事件
- **THEN** 分级器 SHALL 将其分类为 L0，不产生 UI 渲染指令

#### Scenario: 新客户消息升级
- **WHEN** 收到 `lifecycle.start` 事件且 `data.trigger` 为外部消息
- **THEN** 分级器 SHALL 将其分类为 L4

#### Scenario: 错误事件最高级
- **WHEN** 收到 `stream: "error"` 事件
- **THEN** 分级器 SHALL 将其分类为 L4

### Requirement: 时间窗口事件聚合器

系统 SHALL 提供 `EventAggregator` 模块，将 300-800ms 时间窗口内的关联事件聚合为一个 `PerceivedEvent`。

关联判定规则：
1. 同一 `sessionKey` 的事件视为关联
2. 同一 `agentId` 的事件视为关联
3. 同一 `runId` 关联链上的事件视为关联

聚合后 `PerceivedEvent` 的 `level` SHALL 取窗口内所有事件的最高级别。

#### Scenario: 关联事件聚合
- **WHEN** 300ms 内连续收到 `client.message`、`session.open`、`presence.sync`、`agent.route` 四个事件（同一 sessionKey）
- **THEN** 聚合器 SHALL 将它们合并为一个 `PerceivedEvent`，而非产生四个独立事件

#### Scenario: 窗口自适应延长
- **WHEN** 事件窗口内持续有新的关联事件到达
- **THEN** 窗口 SHALL 从初始 300ms 延长，但不超过 800ms 上限

#### Scenario: 不相关事件不聚合
- **WHEN** 两个事件在同一时间窗口内但 sessionKey 和 agentId 均不同
- **THEN** 聚合器 SHALL 将它们作为两个独立的 `PerceivedEvent` 输出

### Requirement: 叙事文本生成器

系统 SHALL 提供 `NarrativeGenerator` 模块，为每个 `PerceivedEvent` 生成中文叙事句。叙事 SHALL 使用预定义的行为模板，根据 `PerceivedEvent.kind` 选择模板。

支持的行为类型（kind）：
- `ARRIVE` → "客户消息到达，Gateway 完成分发，{actor} 开始接单。"
- `DISPATCH` → "{actor} 接到主线任务，开始处理。"
- `ACK` → "{actor} 确认接单。"
- `FOCUS` → "{actor} 专注处理中。"
- `CALL_TOOL` → "{actor} 调用 {tool} 工具。"
- `WAIT` → "{actor} 等待外部返回。"
- `SPAWN_SUBAGENT` → "临时协作者被拉入项目室。"
- `COLLAB` → "{actors} 进入协作模式。"
- `RETURN` → "{actor} 完成处理，结果回到主线。"
- `BROADCAST_CRON` → "Cron 广播触发：{taskName}。"
- `POLL_HEARTBEAT` → "Heartbeat 巡检扫过工位。"
- `BLOCK` → "{actor} 进入阻塞态：{reason}。"
- `RECOVER` → "{actor} 从阻塞中恢复。"

#### Scenario: 叙事句生成
- **WHEN** 聚合器输出一个 `kind: ARRIVE` 的 `PerceivedEvent`，actors 为 `["Sales Agent"]`
- **THEN** 叙事生成器 SHALL 输出 "客户消息到达，Gateway 完成分发，Sales Agent 开始接单。"

#### Scenario: 未匹配模板降级
- **WHEN** 聚合器输出一个无法匹配模板的 `PerceivedEvent`
- **THEN** 叙事生成器 SHALL 输出通用文本 "系统处理中..."，不抛出错误

### Requirement: 感知节流控制器

系统 SHALL 提供 `HoldController` 模块，根据事件级别控制最短展示时间（holdMs）。在 holdMs 到期前，同一 Agent 的新事件 SHALL 进入排队等待，不直接覆盖当前展示。

时间策略：

| 事件类型 | 最短展示时间（holdMs） |
|---------|-------------------|
| 状态闪变（L1） | 800ms |
| 短工位动作（L2） | 1500ms |
| 主线处理（L3） | 2500ms |
| 协作场景（L3+） | 4000ms |
| 阻塞异常（L4 error） | 6000ms |
| 重大恢复 | 3000ms |

#### Scenario: 异常停留更久
- **WHEN** Agent 进入 BLOCKED 状态
- **THEN** 节流控制器 SHALL 强制该 Agent 的 BLOCKED 视觉状态保持至少 6 秒，在此期间新的非异常事件不覆盖此状态

#### Scenario: 正常完成可以快
- **WHEN** Agent 完成一个 L2 短任务
- **THEN** 完成状态 SHALL 保持至少 1.5 秒，让用户能看见"已完成"反馈

#### Scenario: 队列排空
- **WHEN** 多个事件在 holdMs 内排队
- **THEN** 控制器 SHALL 按 FIFO 顺序逐一展示，每个事件保持其对应级别的最短展示时间

### Requirement: 感知引擎总入口

系统 SHALL 提供 `PerceptionEngine` 类作为整个感知层的统一入口，暴露 `ingest(event: AgentEventPayload)` 方法。内部管道为：

```
ingest() → EventClassifier → EventAggregator → NarrativeGenerator → HoldController → emit(PerceivedEvent)
```

引擎 SHALL 通过回调或事件发射器将最终的 `PerceivedEvent` 推送给消费者（ProjectionStore 和 Scene Layer）。

#### Scenario: 端到端事件处理
- **WHEN** Gateway 推送一个 `AgentEventPayload`
- **THEN** 感知引擎 SHALL 按管道顺序处理，最终输出一个或多个 `PerceivedEvent`，每个包含 `kind`、`level`、`actors`、`summary`（叙事文本）、`holdMs`、`debugRefs`（原始事件 ID 列表）

### Requirement: PerceivedEvent 数据模型

系统 SHALL 定义 `PerceivedEvent` 类型：

```typescript
interface PerceivedEvent {
  id: string;                    // 唯一标识
  startTs: number;               // 聚合窗口起始时间
  endTs: number;                 // 聚合窗口结束时间
  kind: PerceivedKind;           // 行为类型（ARRIVE/DISPATCH/BLOCK 等）
  level: EventLevel;             // L0-L4
  actors: string[];              // 涉及的 Agent ID 列表
  area: string;                  // 目标场景区域
  summary: string;               // 叙事文本
  displayPriority: number;       // 展示优先级（1-10）
  holdMs: number;                // 最短展示时间
  debugRefs: string[];           // 原始事件 ID 列表
}
```

#### Scenario: 类型完整性
- **WHEN** 感知引擎输出 `PerceivedEvent`
- **THEN** 所有字段 SHALL 被填充，不允许 undefined（actors 和 debugRefs 允许空数组）
