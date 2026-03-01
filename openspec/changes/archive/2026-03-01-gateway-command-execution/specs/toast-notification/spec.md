## ADDED Requirements

### Requirement: Toast Store 全局状态管理

系统 SHALL 提供独立的 Zustand Store `useToastStore` 管理全局 Toast 通知状态。

Store 包含以下状态：
- `toasts: ToastItem[]` — 当前所有活跃的 Toast 列表
- `addToast(toast: ToastInput): string` — 添加 Toast，返回 ID
- `removeToast(id: string): void` — 移除指定 Toast
- `clearAll(): void` — 清除所有 Toast

`ToastItem` 类型 SHALL 包含：
- `id: string` — 唯一标识
- `type: "success" | "error" | "warning" | "info"` — 消息类型
- `title: string` — 标题
- `message?: string` — 可选的详细消息
- `detail?: string` — 可选的可展开详情（如命令输出日志）
- `duration?: number` — 自动关闭时间（ms），默认 5000，设为 0 不自动关闭
- `createdAt: number` — 创建时间戳

#### Scenario: 添加成功 Toast
- **WHEN** 调用 `addToast({ type: "success", title: "技能已安装" })`
- **THEN** `toasts` 数组新增一项，`type` 为 "success"
- **THEN** 返回该 Toast 的唯一 ID

#### Scenario: Toast 数量限制
- **WHEN** 已有 5 条 Toast 且添加第 6 条
- **THEN** 最早的 Toast 被自动移除，保持最多 5 条

#### Scenario: 手动移除 Toast
- **WHEN** 调用 `removeToast(id)`
- **THEN** 对应 Toast 从 `toasts` 数组中移除

### Requirement: ToastContainer 全局渲染组件

系统 SHALL 提供 `<ToastContainer />` 组件，挂载在应用根布局（AppShell）中。

组件 SHALL：
1. 固定定位在屏幕右上角（`fixed top-4 right-4 z-50`）
2. 从 `useToastStore` 读取 `toasts` 列表并渲染
3. 每条 Toast 以卡片形式展示：图标 + 标题 + 关闭按钮
4. 带有入场/退场动画（淡入滑入 / 淡出滑出）
5. 当 Toast 有 `detail` 字段时，显示"查看详情"展开按钮
6. 自动关闭：到达 `duration` 后触发 `removeToast`

#### Scenario: 渲染错误 Toast
- **WHEN** Store 中存在 `type: "error"` 的 Toast
- **THEN** 渲染红色边框卡片 + 红色错误图标 + 标题文本

#### Scenario: 展开详情
- **WHEN** Toast 包含 `detail` 字段
- **THEN** 卡片下方显示"查看详情"按钮
- **WHEN** 用户点击"查看详情"
- **THEN** 展开显示 monospace 字体的详情文本块
- **THEN** 该 Toast 暂停自动关闭计时

#### Scenario: 自动关闭
- **WHEN** Toast `duration` 为 5000
- **THEN** 5 秒后 Toast 自动移除
- **WHEN** 用户鼠标悬停在 Toast 上
- **THEN** 暂停自动关闭计时，离开后恢复

### Requirement: Toast 辅助函数

系统 SHALL 提供便捷函数简化 Toast 调用：

- `toastSuccess(title, message?)` — 添加 success 类型 Toast
- `toastError(title, message?, detail?)` — 添加 error 类型 Toast，默认 duration 为 0（不自动关闭）
- `toastWarning(title, message?, detail?)` — 添加 warning 类型 Toast
- `toastInfo(title, message?)` — 添加 info 类型 Toast

#### Scenario: 使用辅助函数
- **WHEN** 调用 `toastError("安装失败", "brew not found", stdout)`
- **THEN** 创建 `type: "error"`, `duration: 0` 的 Toast，包含可展开的 stdout 详情
