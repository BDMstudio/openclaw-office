## 1. ClawHub API 客户端

- [x] 1.1 创建 `src/gateway/clawhub-client.ts`：ClawHub API 类型定义（`ClawHubSearchResult`、`ClawHubSkillListItem`、`ClawHubSkillDetail`、`ClawHubExploreResponse`、`ClawHubError`）
- [x] 1.2 实现 `clawhubSearch(query, limit?)` — 调用 `GET /api/v1/search`
- [x] 1.3 实现 `clawhubExplore(options?)` — 调用 `GET /api/v1/skills`，支持分页
- [x] 1.4 实现 `clawhubSkillDetail(slug)` — 调用 `GET /api/v1/skills/:slug`
- [x] 1.5 实现错误处理、Rate Limit 检测、内存缓存（explore 60s、detail 5min）
- [x] 1.6 添加 `VITE_CLAWHUB_REGISTRY` 环境变量支持

## 2. ClawHub Marketplace Store

- [x] 2.1 创建 `src/store/console-stores/clawhub-store.ts`：状态定义（searchResults、exploreItems、isSearching、searchQuery、offlineMode 等）
- [x] 2.2 实现 `search(query)` action：debounce 300ms + 调用 clawhubSearch + 错误降级
- [x] 2.3 实现 `explore(loadMore?)` action：初次加载 + 分页追加
- [x] 2.4 实现 `fetchDetail(slug)` action：获取详情 + 缓存
- [x] 2.5 实现离线降级逻辑：ClawHub 不可达时 `offlineMode = true`

## 3. Marketplace UI 组件

- [x] 3.1 创建 `src/components/console/skills/ClawHubSkillCard.tsx`：展示搜索/浏览结果卡片（名称、简介、版本、更新时间、安装按钮/已安装标识）
- [x] 3.2 创建 `src/components/console/skills/ClawHubDetailDialog.tsx`：skill 详情弹窗（作者、stats、changelog、安装区域）
- [x] 3.3 创建 `src/components/console/skills/ClawHubInstallDialog.tsx`：安装确认弹窗（安装命令展示、Agent 执行 / 手动复制两种方式）
- [x] 3.4 修改 `src/components/pages/SkillsPage.tsx`：Marketplace Tab 从本地过滤重构为 ClawHub 驱动（搜索框 + 搜索按钮 + 结果/浏览切换 + 分页加载）
- [x] 3.5 添加离线降级 UI：ClawHub 不可达时的提示卡和本地 fallback

## 4. 类型层扩展（Gateway Adapter）

- [x] 4.1 在 `src/gateway/adapter-types.ts` 新增 `SkillInstallResult` 类型
- [x] 4.2 修改 `src/gateway/adapter.ts` 的 `skillsInstall` 返回类型为 `Promise<SkillInstallResult>`
- [x] 4.3 修改 `src/gateway/ws-adapter.ts` 透传 Gateway 返回的 `stdout`/`stderr`/`code`/`warnings`
- [x] 4.4 修改 `src/gateway/mock-adapter.ts` 更新模拟返回值

## 5. Toast 通知系统

- [x] 5.1 创建 `src/store/toast-store.ts`：ToastItem 类型、useToastStore、辅助函数（toastSuccess/toastError/toastWarning/toastInfo）
- [x] 5.2 创建 `src/components/shared/ToastContainer.tsx`：渲染、自动关闭、悬停暂停、可展开详情
- [x] 5.3 在 AppShell 中挂载 `<ToastContainer />`
- [x] 5.4 添加 Toast 相关 i18n 翻译键（zh/en）

## 6. 命令输出详情组件

- [x] 6.1 创建 `src/components/shared/CommandResultDetail.tsx`：stdout/stderr 分区展示、warnings、退出码、复制功能
- [x] 6.2 添加 i18n 翻译键（zh/en）

## 7. Skills 操作反馈集成

- [x] 7.1 修改 `skills-store.ts` 的 `installSkill`：返回 `SkillInstallResult`，触发 Toast
- [x] 7.2 修改 `skills-store.ts` 的 `toggleSkill`：成功/失败时触发 Toast
- [x] 7.3 在 SkillsPage 安装失败 Toast 中集成 CommandResultDetail

## 8. Gateway 重启追踪

- [x] 8.1 扩展 `config-store.ts`：新增 `RestartState` 和相关 actions
- [x] 8.2 在 `patchConfig` 中检测 `restart.scheduled` 并启动追踪
- [x] 8.3 创建 `src/components/shared/RestartBanner.tsx`：重启状态横幅
- [x] 8.4 在 AppShell/ConsoleLayout 中挂载 `<RestartBanner />`
- [x] 8.5 集成 WebSocket 连接状态变化更新 restartState
- [x] 8.6 添加重启追踪 i18n 翻译键（zh/en）

## 9. 测试

- [x] 9.1 `clawhub-client` 单元测试：搜索/浏览/详情/缓存/错误处理
- [x] 9.2 `clawhub-store` 单元测试：搜索/浏览/离线降级/分页
- [x] 9.3 `toast-store` 单元测试：增删/数量限制/辅助函数
- [x] 9.4 `skills-store` 扩展测试：installSkill 完整返回 + Toast 集成
- [x] 9.5 `ws-adapter` 测试：skillsInstall 返回完整字段
- [x] 9.6 `config-store` 重启追踪测试

## 10. i18n 补充

- [x] 10.1 添加 ClawHub Marketplace 相关翻译键（zh/en）：搜索、浏览、安装确认、离线提示等
- [x] 10.2 添加安装结果反馈翻译键（zh/en）：成功/失败/警告消息
