## ADDED Requirements

### Requirement: 重启状态 Store 扩展

`useConfigStore` SHALL 扩展以下状态用于追踪 Gateway 重启：

- `restartState: RestartState | null` — 当前重启状态
- `setRestartPending(delayMs: number): void` — 设置重启等待状态
- `setRestartReconnecting(): void` — 设置重连中状态
- `setRestartComplete(): void` — 重启完成
- `clearRestart(): void` — 清除重启状态

`RestartState` 类型：
```
type RestartState = {
  status: "pending" | "disconnected" | "reconnecting" | "complete";
  startedAt: number;
  estimatedDelayMs: number;
};
```

#### Scenario: 配置修改触发重启
- **WHEN** `configPatch` 返回 `restart: { scheduled: true, delayMs: 3000 }`
- **THEN** 调用 `setRestartPending(3000)` 进入重启等待状态

#### Scenario: Gateway 断开连接
- **WHEN** `restartState.status` 为 "pending" 且 WebSocket 连接断开
- **THEN** 状态切换为 "disconnected"

#### Scenario: 重连成功
- **WHEN** `restartState.status` 为 "disconnected" 或 "reconnecting" 且 WebSocket 重新连接成功
- **THEN** 状态切换为 "complete"
- **THEN** 2 秒后自动清除重启状态

### Requirement: RestartBanner 重启状态 UI

系统 SHALL 提供 `<RestartBanner />` 组件，展示 Gateway 重启进度。

组件 SHALL：
1. 仅当 `restartState` 不为 null 时渲染
2. 固定在页面顶部作为横幅通知
3. 根据 `status` 展示不同内容：
   - `pending`: "Gateway 即将重启..." + 倒计时
   - `disconnected`: "Gateway 已断开，正在等待重启..." + 加载动画
   - `reconnecting`: "正在重新连接..." + 加载动画
   - `complete`: "Gateway 已恢复" + 成功图标，2 秒后自动消失

#### Scenario: 显示重启倒计时
- **WHEN** `restartState.status` 为 "pending" 且 `estimatedDelayMs` 为 3000
- **THEN** 横幅显示 "Gateway 即将重启..." 和 3 秒倒计时

#### Scenario: 重启完成自动消失
- **WHEN** `restartState.status` 变为 "complete"
- **THEN** 横幅显示 "Gateway 已恢复" 成功消息
- **THEN** 2 秒后横幅自动消失

#### Scenario: 无重启时不渲染
- **WHEN** `restartState` 为 null
- **THEN** `RestartBanner` 不渲染任何内容

### Requirement: 配置页面集成重启追踪

Settings 页面的 `patchConfig` 操作 SHALL 在收到重启响应后启动追踪。

#### Scenario: 保存配置触发重启
- **WHEN** 用户在 Settings 页面保存配置
- **WHEN** `configPatch` 返回 `restart.scheduled = true`
- **THEN** 调用 `setRestartPending(delayMs)` 启动重启追踪
- **THEN** 页面顶部出现 RestartBanner

#### Scenario: 保存配置无需重启
- **WHEN** `configPatch` 返回无 `restart` 字段
- **THEN** 不启动重启追踪，仅显示保存成功 Toast
