## Why

机器的处理速度是毫秒级，人的理解速度是秒级。如果把 OpenClaw Gateway 的真实 runtime 事件直接渲染成动画，用户会看到：瞬移、闪烁、不明所以的状态切换、很多动作但没有因果。

当前实现中 `EventThrottle` 只做了简单的 rAF 批处理，没有**事件聚合**（多个关联事件合并为一个叙事）、**感知节流**（按事件级别控制最短展示时间）、**叙事化**（把技术事件翻译成"组织行为语言"）。这意味着接入真实 Gateway 后，界面会因事件频繁而视觉崩坏。

产品蓝图定义了 **Runtime Truth Layer → Perception Layer → Scene Layer** 三层架构，本提案实现中间的 Perception Layer——事件压缩引擎，让 Living Office 场景接收的是"人类可感知的组织行为片段"，而非原始的毫秒级系统噪声。

## What Changes

- **新增 Perception Engine**：接收 Gateway 原始事件，输出 `PerceivedEvent`（聚合后的叙事片段），包含事件分级（L0-L4）、时间窗口聚合（300-800ms）、叙事化文本生成
- **新增事件分级系统**：L0 毫秒噪声（不上屏）、L1 轻事件（仅改灯/图标）、L2 短任务（工位层动作）、L3 中任务（允许跨区移动）、L4 重要事件（强叙事 + 保留更久）
- **新增感知节流控制器**：根据事件级别强制最短展示时间（0.8s ~ 6s），避免状态闪变；异常事件比正常事件停留更久
- **新增叙事生成器**：把技术事件（`client.message` + `session.open` + `presence.sync`）翻译成可读叙事句（"客户消息到达，Gateway 完成分发，Sales Agent 开始接单"）
- **新增 Projection Store**：维护当前所有 Agent 的可视投影状态（`AgentProjection`），支持前端断线重连时的完整状态恢复
- **重构事件流管道**：替换现有 `EventThrottle` 为 Perception Engine，保持 `office-store.processAgentEvent` 接口不变

## Capabilities

### New Capabilities
- `perception-engine`: 感知层引擎——事件聚合、分级、节流、叙事化，将毫秒级 Gateway 事件转换为秒级可感知组织行为
- `projection-store`: 投影状态存储——维护所有 Agent 的当前可视状态投影，支持增量更新和完整快照

### Modified Capabilities

（本子提案不修改现有能力的需求规格，Perception Engine 作为新层插入事件管道）

## Impact

- **新增文件**：`src/perception/` 目录（5-8 个模块文件）
- **修改文件**：`src/gateway/ws-adapter.ts`（事件出口接入 Perception Engine）、`src/store/office-store.ts`（接收 `PerceivedEvent` 而非 `AgentEventPayload`）
- **替换现有模块**：`EventThrottle` 类被 Perception Engine 替代（保留旧代码供旧渲染路径使用）
- **依赖**：无新增外部依赖
- **性能**：事件聚合窗口增加 300-800ms 延迟，但这是有意的——确保人类能感知到正在发生的事情
