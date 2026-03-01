## ADDED Requirements

### Requirement: CommandResultDetail 命令输出展示组件

系统 SHALL 提供 `<CommandResultDetail />` 组件，用于在 Toast 详情或弹窗中展示 Gateway 命令的执行输出。

组件接受以下 props：
- `stdout?: string` — 标准输出
- `stderr?: string` — 标准错误
- `exitCode?: number | null` — 退出码
- `warnings?: string[]` — 警告列表

组件 SHALL：
1. 以 monospace 字体渲染 stdout/stderr 内容
2. stdout 和 stderr 分开展示，stderr 用红色边框标识
3. 如有 warnings，以黄色警告列表展示
4. 内容区域可滚动，最大高度 300px
5. 提供"复制全部"按钮，将所有输出复制到剪贴板
6. 空内容区域不渲染对应 section

#### Scenario: 展示安装成功输出
- **WHEN** 传入 `stdout: "Successfully installed playwright"`, `exitCode: 0`
- **THEN** 渲染绿色状态标识 + stdout 内容块

#### Scenario: 展示安装失败输出
- **WHEN** 传入 `stderr: "brew not found"`, `exitCode: 1`
- **THEN** 渲染红色状态标识 + stderr 内容块（红色边框）

#### Scenario: 展示警告
- **WHEN** 传入 `warnings: ["Skill contains suspicious code patterns"]`
- **THEN** 在输出块上方渲染黄色警告列表

#### Scenario: 复制输出
- **WHEN** 用户点击"复制全部"按钮
- **THEN** stdout + stderr + warnings 全部复制到剪贴板
- **THEN** 按钮短暂变为"已复制"状态

#### Scenario: 空输出不渲染
- **WHEN** `stdout` 为空字符串且 `stderr` 为空字符串
- **THEN** 仅显示退出码信息，不渲染输出块
