## Why

OpenClaw Office 的 Console Skills 页面目前存在两个层面的功能缺失：

### 层面一：ClawHub Marketplace 搜索与安装完全缺失

OpenClaw 的 Skills 生态由 **ClawHub** (`clawhub.ai`) 提供注册中心服务。ClawHub 拥有完整的 REST API：
- `GET /api/v1/search?q=xxx&limit=N` — 向量语义搜索 skills
- `GET /api/v1/skills?limit=N&cursor=xxx` — 浏览最新 skills
- `GET /api/v1/skills/:slug` — 获取 skill 详情（含作者、stats、版本历史）
- `GET /api/v1/download?slug=xxx&version=xxx` — 下载 skill zip 包

**安装 ClawHub skill** 的流程是：从 ClawHub API 下载 zip → 解压到 `~/.openclaw/workspace/skills/<slug>/` → 写入 `.clawhub/origin.json` 元数据 → OpenClaw 自动发现并加载该 skill。

但当前前端完全没有对接 ClawHub API。Marketplace Tab 仅从 `skills.status`（本地已发现的 skills）中过滤 `!isBundled` 的条目做本地展示，**无法搜索和安装 ClawHub 上的数千个社区 skills**。

### 层面二：Skills 操作反馈不完整

Gateway 的 `skills.install` RPC（安装 skill 的**系统依赖**如 brew/npm/go 二进制工具）返回了 `{ ok, message, stdout, stderr, code, warnings }`，但前端丢弃了 `stdout`/`stderr`/`warnings` 诊断信息。同时缺乏 Toast 通知、配置修改后 Gateway 重启状态追踪等操作反馈机制。

### 两个概念的区分

| 操作 | 含义 | 机制 |
|------|------|------|
| ClawHub install | 从 ClawHub 下载 skill 定义（SKILL.md + 辅助文件） | HTTP 下载 zip → 解压到 workspace/skills/ |
| Gateway skills.install | 安装 skill 所需的系统依赖（brew/npm/go/uv 二进制） | RPC → Gateway 执行 shell 命令 |

两者是**互补**关系：先从 ClawHub install 下载 skill 定义，然后可能需要 Gateway skills.install 来安装该 skill 声明的系统依赖。

### 实际验证

已在本机通过 ClawHub CLI 成功搜索并安装了 `powerpoint-pptx` skill：
```
clawhub search pptx → 找到 10 个结果
clawhub install powerpoint-pptx → 安装到 ~/.openclaw/workspace/skills/powerpoint-pptx/
openclaw skills list → 已显示为 "ready" 状态
```

## What Changes

### Phase 1: ClawHub Marketplace 集成（核心）
- **ClawHub API 客户端**：在前端新增 ClawHub REST API 调用层，支持搜索、浏览、获取详情、下载安装
- **Marketplace 搜索功能**：Marketplace Tab 从"本地过滤"升级为"ClawHub 向量语义搜索"，搜索按钮真正发起远程请求
- **ClawHub Skill 安装**：Marketplace 中可一键安装 ClawHub 上的 skill（下载 zip → 通知 Gateway 刷新）
- **Skill 详情页增强**：展示 ClawHub 元数据（作者、下载量、星标数、版本历史、changelog）

### Phase 2: 操作反馈完善
- **Toast 通知系统**：统一的操作反馈组件
- **安装结果详情**：`skills.install`（系统依赖安装）的 stdout/stderr/warnings 展示
- **Gateway 重启追踪**：配置修改后的重启状态横幅

### Phase 3: 后续扩展（不在本次范围）
- ClawHub skill 卸载（`clawhub uninstall`）
- Skill 更新检查与升级（`clawhub update`）
- 用户登录/Star/发布等社交功能

## Capabilities

### New Capabilities
- `clawhub-client`: ClawHub REST API 客户端，封装搜索/浏览/详情/下载/安装的 HTTP 调用
- `clawhub-marketplace`: Marketplace Tab 全面升级为 ClawHub 驱动的远程搜索与安装体验
- `toast-notification`: 全局 Toast 通知系统
- `gateway-restart-tracker`: 配置修改后 Gateway 重启状态追踪
- `command-result-detail`: Gateway 命令执行结果详情展示组件

### Modified Capabilities
- `skills-page`: Marketplace Tab 从本地过滤升级为 ClawHub 远程搜索；安装操作增加反馈
- `gateway-adapter`: `skillsInstall` 返回类型扩展；新增 ClawHub 相关的状态刷新

## Impact

- **新模块**：`src/gateway/clawhub-client.ts`（ClawHub API 客户端）
- **新 Store**：`src/store/console-stores/clawhub-store.ts`（ClawHub 搜索/安装状态）、`src/store/toast-store.ts`
- **新组件**：`ClawHubSearchResults`、`ClawHubSkillCard`、`ClawHubSkillDetailDialog`、`ToastContainer`、`RestartBanner`、`CommandResultDetail`
- **修改组件**：`SkillsPage.tsx`（Marketplace Tab 重构）、`AppShell.tsx`（挂载 Toast + RestartBanner）
- **修改类型**：`adapter-types.ts`（SkillInstallResult 扩展、ClawHub 类型）
- **安全考虑**：ClawHub API 为公开只读接口（搜索/浏览/下载不需要认证），安装操作需安全审查提示
- **网络依赖**：Marketplace 功能需要能访问 `clawhub.ai`，离线时降级为本地已安装列表
- **关键路径**：ClawHub skill 安装后需通知 Gateway 刷新 `skills.status`，确保新 skill 被发现
