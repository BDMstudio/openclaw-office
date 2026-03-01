## Context

OpenClaw 的 Skills 生态分为两层：

1. **ClawHub Registry** (`clawhub.ai`) — 社区 Skills 注册中心，提供搜索、浏览、下载功能
2. **OpenClaw Gateway** — 本地运行的后端，管理已发现 skills 的状态、启用/禁用、系统依赖安装

当前前端仅对接了 Gateway 层（`skills.status`/`skills.install`/`skills.update`），完全没有对接 ClawHub Registry 层。

ClawHub CLI (`clawhub`) 已有完整的搜索和安装能力，但它是一个命令行工具。前端需要直接调用 ClawHub REST API 来提供同等的 Web UI 体验。

### ClawHub API 实际验证结果

| 端点 | 验证状态 | 响应格式 |
|------|---------|---------|
| `GET /api/v1/search?q=pptx&limit=5` | ✅ 正常 | `{ results: [{ score, slug, displayName, summary, version, updatedAt }] }` |
| `GET /api/v1/skills?limit=5` | ✅ 正常 | `{ items: [{ slug, displayName, summary, tags, stats, latestVersion, metadata }], nextCursor }` |
| `GET /api/v1/skills/:slug` | ✅ 正常 | `{ skill, latestVersion, metadata, owner, moderation }` |
| `GET /api/v1/download?slug=xxx` | ✅ 正常 | 返回 zip 二进制（ClawHub CLI 使用） |

所有端点无需认证即可访问（搜索/浏览/下载为公开 API）。

### Skill 安装流程验证

已实际执行 `clawhub install powerpoint-pptx`，确认流程：
1. 调用 `/api/v1/resolve` 解析版本
2. 调用 `/api/v1/download` 下载 zip
3. 解压到 `~/.openclaw/workspace/skills/powerpoint-pptx/`
4. 写入 `.clawhub/origin.json`（包含 registry, slug, version, installedAt）
5. OpenClaw 自动发现并在 `skills list` 中显示为 "ready"

## Goals / Non-Goals

**Goals:**
- 前端直接调用 ClawHub REST API，实现 Marketplace 搜索/浏览/安装的完整体验
- ClawHub 安装后通过 Gateway RPC 刷新 skill 状态
- 区分两种安装操作：ClawHub install（下载 skill 定义）vs Gateway skills.install（安装系统依赖）
- 建立 Toast 通知和操作反馈机制
- Gateway 配置修改后的重启状态追踪

**Non-Goals:**
- 不引入 RSC — 项目是纯 SPA，ClawHub API 可从浏览器直接调用
- 不通过 Gateway 代理 ClawHub API — ClawHub API 是公开的 HTTPS 端点，前端可直接调用
- 不实现 ClawHub 登录/发布/Star 等需要认证的功能（Phase 3）
- 不实现 skill 卸载和更新（Phase 3）
- 不修改 Gateway 后端代码

## Decisions

### 决策 1：ClawHub API 调用方式 — 前端直接调用 vs Gateway 代理

**选择**：前端直接调用 ClawHub REST API。

**理由**：
- ClawHub 搜索/浏览/详情 API 是公开的 HTTPS 端点，无需认证
- 减少 Gateway 的职责和延迟
- 与 ClawHub 官网（clawhub.ai）使用相同的 API
- 避免需要修改 Gateway 协议来添加代理方法

**备选方案**：
- 方案 B：Gateway 新增 `clawhub.search`/`clawhub.install` RPC → 需改 Gateway，且增加不必要的中间层
- 方案 C：通过 Gateway 的 chat agent（clawhub skill）间接搜索 → 不可控，不适合 UI 直接交互

### 决策 2：ClawHub Skill 安装方式 — 前端下载 vs Gateway 执行

**选择**：安装操作通过 Gateway 执行（需要新增 RPC 或利用现有能力）。

**难点分析**：
- ClawHub skill 安装需要写入服务端文件系统（`~/.openclaw/workspace/skills/`）
- 前端（浏览器）无法直接写入服务端文件系统
- Gateway 目前没有 `clawhub.install` RPC

**解决方案**：分为两步：
1. **搜索/浏览/详情**：前端直接调用 ClawHub API（纯读取）
2. **安装**：通过 Gateway 已有的 `agent` 事件机制 + `chat.send` RPC，让 Gateway 执行 `clawhub install <slug>`
   - 或者更优方案：Gateway 的 `skills.install` RPC 可以扩展接受 `{ kind: "clawhub", slug, version }` 参数
   - 但这需要 Gateway 侧改动，**备选方案**：前端通过 `chat.send` 发送安装命令让 Agent 执行

**最终选择**：使用最轻量的路径 — Gateway 确认 `clawhub` binary 已安装后，前端调用 Gateway 现有的通用命令执行能力或直接让用户确认后通过 chat 发送安装指令。鉴于 Gateway 已经有 `clawhub` 作为 bundled skill，可以通过 Agent 执行 `clawhub install <slug>` 完成安装。

**实际落地方案**：考虑到 Gateway 修改不在本次范围内，采用混合策略：
- 短期：安装按钮触发时，弹出安装确认弹窗展示安装命令（`clawhub install <slug>`），用户可：
  a. 一键复制命令到终端执行
  b. 通过 Chat（如果 Gateway 连接中）发送安装指令让 Agent 执行
- 中期：后续 Gateway 新增 `clawhub.install` RPC 后，前端直接调用

### 决策 3：Marketplace 数据源架构

**选择**：Marketplace Tab 使用独立的 ClawHub Store，与现有的 Skills Store 分离。

**理由**：
- ClawHub 数据（远程搜索结果）和本地 skills 数据（`skills.status`）是不同数据源
- 搜索是异步远程请求，需要独立的 loading/error 状态
- 安装一个 ClawHub skill 后，需要刷新本地 `skills.status` 来同步
- 分离 Store 避免本地/远程数据混淆

### 决策 4：离线降级策略

**选择**：ClawHub 不可达时，Marketplace Tab 降级为本地过滤模式。

**理由**：
- 用户可能在无网络环境中使用 OpenClaw Office
- 降级为当前行为（过滤 `skills.status` 中的非 bundled skills）是合理的后备
- 明确提示用户"无法连接 ClawHub，显示本地 skills"

### 决策 5：Toast 通知架构

**选择**：独立的 Zustand `toast-store` + 全局 `<ToastContainer>` 组件。

**理由**：保持与项目现有架构一致，轻量实现。

### 决策 6：Gateway 重启追踪

**选择**：基于 WebSocket 连接状态 + `config.patch` 返回的 `restart.delayMs` 做被动追踪。

## Risks / Trade-offs

- **[Risk] ClawHub API 限流** → 实测遇到了 Rate Limit。Mitigation: 搜索做 debounce（300ms+），缓存搜索结果，浏览列表使用分页
- **[Risk] ClawHub API 不可用** → Mitigation: 降级为本地过滤模式，明确提示
- **[Risk] CORS 限制** → 需验证 `clawhub.ai` 是否允许浏览器跨域请求。如有 CORS 问题，需通过 Gateway 代理
- **[Risk] ClawHub skill 安装需文件系统写入** → 前端无法直接完成，需借助 Gateway/Agent。短期提供命令复制方案
- **[Trade-off] 安装不是一键完成** → 短期需用户手动执行命令或通过 Chat Agent 间接执行，中期等待 Gateway 新增 RPC
- **[Trade-off] 命令输出为纯文本展示** → 不做终端模拟，monospace 字体展示
