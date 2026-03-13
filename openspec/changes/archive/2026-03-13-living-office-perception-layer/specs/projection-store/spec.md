## ADDED Requirements

### Requirement: Agent 投影状态存储

系统 SHALL 提供 `ProjectionStore` 模块（Zustand store），维护所有 Agent 的当前可视投影状态。每个 Agent 的投影 SHALL 包含：

- `agentId`: Agent 标识
- `role`: 角色名称
- `state`: 当前可视状态（IDLE/INCOMING/ACK/WORKING/TOOL_CALL/WAITING/COLLABORATING/RETURNING/DONE/BLOCKED/RECOVERED）
- `deskId`: 工位标识
- `sessionId`: 当前 session（可选）
- `taskSummary`: 当前任务摘要（可选）
- `tool`: 当前使用的工具（可选）
- `load`: 负载水平（0-1）
- `lastHeartbeatAt`: 最后一次心跳时间
- `health`: 健康状态（ok/warn/error）

#### Scenario: 投影状态初始化
- **WHEN** Gateway 返回 Agent 列表（`agents.list` RPC）
- **THEN** ProjectionStore SHALL 为每个 Agent 创建初始投影状态（state=IDLE, health=ok, load=0）

#### Scenario: 投影状态更新
- **WHEN** 感知引擎输出一个 `PerceivedEvent`
- **THEN** ProjectionStore SHALL 根据事件的 `kind` 和 `actors` 更新对应 Agent 的投影状态

#### Scenario: 状态回退
- **WHEN** Agent 从 WORKING 状态完成任务
- **THEN** ProjectionStore SHALL 在 holdMs 到期后将 Agent 状态回退到 IDLE

### Requirement: 全局投影快照

ProjectionStore SHALL 提供 `getSnapshot()` 方法，返回当前所有 Agent 投影状态的完整快照。此快照 SHALL 用于：

- 新组件挂载时的初始渲染
- 断线重连后的状态恢复
- 调试面板的状态检视

#### Scenario: 快照一致性
- **WHEN** 调用 `getSnapshot()`
- **THEN** 返回的快照 SHALL 反映当前所有 Agent 的最新投影状态，不包含已过期的临时状态

### Requirement: 叙事日志维护

ProjectionStore SHALL 维护最近 5-7 条叙事日志（`NarrativeLog`），每条包含时间戳和叙事文本。新日志追加到列表尾部，超过上限后 FIFO 淘汰最旧条目。

#### Scenario: 日志滚动
- **WHEN** 第 8 条叙事日志产生
- **THEN** 最旧的一条 SHALL 被淘汰，列表保持最多 7 条

### Requirement: 场景区域状态

ProjectionStore SHALL 维护场景区域的状态，包括：

- `gatewayStream`: Gateway 事件流信息（4 条流状态行）
- `cronTasks`: 当前活跃的 Cron 任务列表
- `memoryItems`: 共享记忆墙条目
- `projectTasks`: 临时项目室任务列表
- `opsRules`: 运营行为板规则列表

#### Scenario: 区域数据更新
- **WHEN** 感知引擎输出 `BROADCAST_CRON` 类型的 `PerceivedEvent`
- **THEN** ProjectionStore SHALL 更新 `cronTasks` 列表
