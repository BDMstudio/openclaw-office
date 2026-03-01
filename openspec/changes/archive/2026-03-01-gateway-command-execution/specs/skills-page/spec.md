## MODIFIED Requirements

### Requirement: Marketplace 视图参考 ClawHub 驱动的远程搜索

Marketplace 视图 SHALL 从 `skills.status()` 本地过滤升级为 ClawHub Registry 驱动的远程搜索与浏览。

1. **搜索栏** — 输入关键词后自动 debounce 搜索 ClawHub（`/api/v1/search`）
2. **搜索按钮** — `onClick` SHALL 立即触发搜索（不再为空）
3. **默认浏览** — 无搜索词时展示 ClawHub 最新 skills（`/api/v1/skills`）
4. **安全提示卡** — 安装前审查 skill 来源和代码
5. **离线降级** — ClawHub 不可达时降级为本地过滤（当前行为）
6. **分页** — 浏览模式下支持"加载更多"

**说明**：
- Marketplace 数据源从 `skills.status` 的非 bundled 子集变为 ClawHub Registry API
- 搜索行为从本地字符串匹配变为 ClawHub 向量语义搜索
- 已安装 skill 的标识通过对比本地 `skills.status` 数据实现

#### Scenario: ClawHub 搜索
- **WHEN** 用户在 Marketplace 视图输入 "pptx"
- **THEN** 300ms debounce 后向 ClawHub API 发起搜索
- **THEN** 返回语义相关的结果（如 powerpoint-pptx、pptx-2 等）

#### Scenario: 搜索按钮功能
- **WHEN** 用户输入 "presentation" 并点击搜索按钮
- **THEN** 立即执行 ClawHub 搜索（不等 debounce）

#### Scenario: 默认浏览
- **WHEN** 搜索框为空
- **THEN** 展示 ClawHub 最新更新的 skills

#### Scenario: 离线降级
- **WHEN** ClawHub API 不可达
- **THEN** 显示提示 "无法连接 ClawHub"
- **THEN** 降级为本地 `skills.status` 非 bundled 过滤

### Requirement: 技能安装操作（扩展两种安装类型）

Skills 页面 SHALL 区分两种安装操作：

**类型 A：ClawHub Skill 安装（下载 skill 定义）**
- 触发：Marketplace Tab 中 ClawHub 搜索结果的安装按钮
- 操作：从 ClawHub 下载 skill zip → 解压到 workspace/skills/
- 方式：通过 Agent 执行 `clawhub install <slug>` 或用户手动执行

**类型 B：系统依赖安装（安装 skill 所需的 bins）**
- 触发：Installed Tab 中 skill 有 `missing.bins` 且有 `installOptions`
- 操作：通过 Gateway RPC `skills.install` 执行 brew/npm/go 等命令
- 返回：`{ ok, message, stdout, stderr, code, warnings }`

两种安装成功后 SHALL 都通过 Toast 展示结果。

#### Scenario: ClawHub 安装成功
- **WHEN** 用户在 Marketplace 确认安装 "powerpoint-pptx"
- **WHEN** Agent 执行 `clawhub install powerpoint-pptx` 成功
- **THEN** 显示成功 Toast "PowerPoint PPTX 已安装"
- **THEN** 自动刷新 skills.status 列表

#### Scenario: 系统依赖安装成功
- **WHEN** 用户在 Installed Tab 点击安装 playwright 的 brew 依赖
- **WHEN** `skillsInstall("playwright", "brew")` 返回 `{ ok: true }`
- **THEN** 显示成功 Toast

#### Scenario: 系统依赖安装失败
- **WHEN** `skillsInstall()` 返回 `{ ok: false, stderr: "command not found: brew" }`
- **THEN** 显示错误 Toast，可展开查看 stderr 详情

### Requirement: 技能切换操作反馈

用户切换技能启用开关时 SHALL 显示 Toast 反馈。

#### Scenario: 切换成功
- **WHEN** `toggleSkill` 操作成功
- **THEN** 显示成功 Toast "技能 xxx 已启用/已禁用"

#### Scenario: 切换失败
- **WHEN** `toggleSkill` 操作失败
- **THEN** 开关回滚到之前的状态
- **THEN** 显示错误 Toast

## MODIFIED Requirements

### Requirement: Skills Store 扩展

`useSkillsStore` SHALL 扩展 `installSkill` 方法的返回类型为 `SkillInstallResult`（包含 `stdout`/`stderr`/`code`/`warnings`），并在安装完成后自动触发 Toast 通知。

`toggleSkill` SHALL 在成功/失败时自动触发 Toast 通知。

#### Scenario: installSkill 返回完整结果
- **WHEN** `installSkill("playwright", "brew")` 完成
- **THEN** 返回包含 `ok, message, stdout, stderr, code, warnings` 的完整结果
- **THEN** 根据结果类型自动触发对应 Toast
