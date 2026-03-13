## 1. 类型定义

- [x] 1.1 创建 `src/perception/types.ts`，定义 `PerceivedEvent`、`PerceivedKind`（13 种行为类型）、`EventLevel`（L0-L4）、`AgentProjection`、`PerceivedAgentState`（11 种状态）、`NarrativeLog` 类型
- [x] 1.2 定义时间策略常量（`HOLD_TIMES`）和聚合窗口常量（`AGGREGATE_WINDOW_MIN/MAX`）

## 2. 事件分级器

- [x] 2.1 创建 `src/perception/event-classifier.ts`，实现 `classifyEvent(event: AgentEventPayload): EventLevel` 函数
- [x] 2.2 编写分级规则映射表（stream × data 字段组合 → L0-L4）
- [x] 2.3 为分级器编写单元测试（覆盖 L0 presence、L2 lifecycle.start、L4 error/blocked 等场景）

## 3. 事件聚合器

- [x] 3.1 创建 `src/perception/event-aggregator.ts`，实现 `EventAggregator` 类
- [x] 3.2 实现滑动窗口逻辑（300ms 初始窗口，关联事件延长到 max 800ms）
- [x] 3.3 实现关联判定（sessionKey / agentId / runId 关联链）
- [x] 3.4 实现窗口关闭后的 `PerceivedEvent` 输出（合并 level、计算 kind）
- [x] 3.5 为聚合器编写单元测试（关联事件聚合、不相关事件分离、窗口超时）

## 4. 叙事生成器

- [x] 4.1 创建 `src/perception/narrative-generator.ts`，定义 13 种 `PerceivedKind` 的中文叙事模板
- [x] 4.2 实现 `generateNarrative(event: PerceivedEvent): string` 函数，支持 actors/context 插值
- [x] 4.3 实现未匹配模板的降级处理（通用文本"系统处理中..."）
- [x] 4.4 为叙事生成器编写单元测试

## 5. 感知节流控制器

- [x] 5.1 创建 `src/perception/hold-controller.ts`，实现 `HoldController` 类
- [x] 5.2 实现 hold 队列逻辑——按 Agent 维度管理，holdMs 到期前新事件排队
- [x] 5.3 实现异常事件 holdMs 放大逻辑（BLOCKED × 2-3 倍）
- [x] 5.4 为节流控制器编写单元测试（hold 到期、队列 FIFO、异常停留更久）

## 6. 感知引擎总入口

- [x] 6.1 创建 `src/perception/perception-engine.ts`，实现 `PerceptionEngine` 类
- [x] 6.2 组合 classifier → aggregator → narrative → hold 管道
- [x] 6.3 暴露 `ingest(event)` 入口和 `onPerceived(callback)` 事件发射
- [x] 6.4 为感知引擎编写集成测试（端到端事件处理 → PerceivedEvent 输出）

## 7. 投影状态存储

- [x] 7.1 创建 `src/perception/projection-store.ts`，使用 Zustand + Immer 实现 ProjectionStore
- [x] 7.2 实现 Agent 投影状态的 CRUD（初始化、更新、回退到 IDLE）
- [x] 7.3 实现 `getSnapshot()` 完整快照方法
- [x] 7.4 实现叙事日志维护（最多 7 条，FIFO 淘汰）
- [x] 7.5 实现场景区域状态维护（gatewayStream / cronTasks / memoryItems / projectTasks / opsRules）
- [x] 7.6 为 ProjectionStore 编写单元测试

## 8. 集成与验证

- [x] 8.1 在 `useGatewayConnection` hook 中添加 PerceptionEngine 分发路径（与旧 EventThrottle 并行）
- [x] 8.2 验证 TypeScript 类型检查通过
- [x] 8.3 验证 Lint 检查通过
- [x] 8.4 使用 Mock 模式验证感知引擎端到端工作（事件 → 聚合 → 叙事 → 投影更新）
