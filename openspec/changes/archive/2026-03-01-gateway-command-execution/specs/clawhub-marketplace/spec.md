## ADDED Requirements

### Requirement: ClawHub Store 状态管理

系统 SHALL 提供独立的 Zustand Store `useClawHubStore` 管理 Marketplace 搜索与浏览状态。

Store 状态：
- `searchResults: ClawHubSearchResult[]` — 搜索结果
- `exploreItems: ClawHubSkillListItem[]` — 浏览列表
- `searchQuery: string` — 当前搜索词
- `isSearching: boolean` — 搜索请求进行中
- `isExploring: boolean` — 浏览加载进行中
- `searchError: string | null` — 搜索错误
- `exploreError: string | null` — 浏览错误
- `nextCursor: string | null` — 浏览分页光标
- `selectedDetail: ClawHubSkillDetail | null` — 选中的 skill 详情
- `detailLoading: boolean` — 详情加载中
- `offlineMode: boolean` — ClawHub 不可达，降级为本地模式

Actions：
- `search(query: string): Promise<void>` — 执行 ClawHub 搜索（自带 debounce）
- `explore(loadMore?: boolean): Promise<void>` — 浏览或加载更多
- `fetchDetail(slug: string): Promise<void>` — 获取 skill 详情
- `clearSearch(): void` — 清除搜索结果，回到浏览模式
- `setOfflineMode(offline: boolean): void` — 设置离线模式

#### Scenario: 执行搜索
- **WHEN** 调用 `search("presentation")`
- **THEN** `isSearching` 变为 true
- **THEN** 调用 ClawHub API 完成后，`searchResults` 更新，`isSearching` 变为 false

#### Scenario: 搜索失败降级
- **WHEN** ClawHub API 调用失败
- **THEN** `searchError` 设置错误信息
- **THEN** `offlineMode` 变为 true
- **THEN** 页面降级为本地过滤模式

#### Scenario: 浏览加载更多
- **WHEN** 调用 `explore(true)` 且 `nextCursor` 非 null
- **THEN** 追加新数据到 `exploreItems`，更新 `nextCursor`

### Requirement: Marketplace Tab 升级为 ClawHub 驱动

SkillsPage 的 Marketplace Tab SHALL 从本地过滤升级为 ClawHub 远程搜索与浏览。

Marketplace 视图 SHALL 包含：
1. **搜索栏** — 输入关键词后 debounce 自动搜索 ClawHub
2. **搜索按钮** — 点击立即执行搜索（不再是装饰）
3. **搜索结果/浏览列表** — 搜索时显示搜索结果，无搜索词时显示最新 skills 浏览
4. **安全提示卡** — 安装前审查 skill 来源和代码
5. **分页加载** — 浏览模式下"加载更多"按钮
6. **离线降级提示** — ClawHub 不可达时显示提示并降级

#### Scenario: 搜索 ClawHub skills
- **WHEN** 用户在搜索框输入 "pptx"
- **THEN** 300ms debounce 后自动向 ClawHub API 发起搜索
- **THEN** 结果展示为 ClawHub skill 卡片列表

#### Scenario: 默认浏览模式
- **WHEN** 用户进入 Marketplace Tab 且搜索框为空
- **THEN** 自动加载 ClawHub 最新 skills 列表

#### Scenario: 搜索按钮点击
- **WHEN** 用户输入搜索词并点击搜索按钮
- **THEN** 立即执行搜索（不等 debounce）

#### Scenario: 清除搜索
- **WHEN** 用户清空搜索框或点击清除按钮
- **THEN** 回到浏览模式，显示最新 skills

#### Scenario: 离线降级
- **WHEN** ClawHub API 不可达
- **THEN** 显示离线提示："无法连接 ClawHub，显示本地已安装 skills"
- **THEN** 降级为当前的本地过滤行为

### Requirement: ClawHub Skill 卡片

系统 SHALL 提供 `<ClawHubSkillCard />` 组件展示 ClawHub 搜索/浏览结果。

卡片 SHALL 展示：
1. Skill 名称（displayName）
2. 简介（summary），截断为 2 行
3. 版本号
4. 更新时间（相对时间，如"3天前"）
5. 安装按钮 / 已安装标识
6. 如在搜索结果中，显示匹配分数标识

卡片交互：
- 点击卡片主体 → 打开 skill 详情弹窗
- 点击安装按钮 → 触发安装流程

#### Scenario: 渲染搜索结果卡片
- **WHEN** 搜索返回 `{ slug: "powerpoint-pptx", displayName: "PowerPoint PPTX", score: 3.69 }`
- **THEN** 渲染卡片显示名称、简介、版本、相关度标识

#### Scenario: 标识已安装 skill
- **WHEN** ClawHub 搜索结果中的 slug 与本地已安装 skill 匹配
- **THEN** 卡片右上角显示"已安装"标识而非安装按钮

### Requirement: ClawHub Skill 详情弹窗

点击 ClawHub skill 卡片 SHALL 打开详情弹窗，展示完整信息。

弹窗 SHALL 包含：
1. **头部** — 名称、简介、版本
2. **作者信息** — 头像、handle、链接
3. **统计数据** — 下载量、安装量、星标数
4. **最新版本** — 版本号、发布时间、changelog
5. **安装区域** — 安装按钮 + 安装命令展示
6. **ClawHub 链接** — 在 clawhub.ai 上查看的外部链接

#### Scenario: 查看 powerpoint-pptx 详情
- **WHEN** 用户点击 powerpoint-pptx 卡片
- **THEN** 弹窗展示：作者 "Iván"、下载量 2363、星标 2、版本 1.0.0

### Requirement: ClawHub Skill 安装流程

用户在 Marketplace 点击安装按钮 SHALL 触发以下流程：

1. 弹出安装确认弹窗，展示：
   - Skill 名称和简介
   - 安装命令：`clawhub install <slug>`
   - 安全审查提醒
2. 用户确认后，系统 SHALL 尝试以下安装方式（按优先级）：
   a. 如果 Gateway 已连接且 `clawhub` skill 可用，通过 `chat.send` 发送安装指令让 Agent 执行
   b. 显示安装命令让用户手动复制执行
3. 安装完成后（通过 Gateway 事件或用户确认），自动刷新 `skills.status`

#### Scenario: 通过 Agent 安装
- **WHEN** Gateway 已连接且 `clawhub` skill 状态为 ready
- **WHEN** 用户确认安装 "powerpoint-pptx"
- **THEN** 通过 `chat.send` 发送 `clawhub install powerpoint-pptx`
- **THEN** 展示安装进度（Agent 的流式响应）
- **THEN** 安装完成后自动刷新 skills 列表

#### Scenario: 命令复制安装
- **WHEN** Gateway 未连接或 `clawhub` skill 不可用
- **WHEN** 用户确认安装
- **THEN** 显示安装命令 `clawhub install <slug>` 并提供一键复制
- **THEN** 提供"安装完成"手动确认按钮，点击后刷新 skills 列表

#### Scenario: 安装已安装的 skill
- **WHEN** 用户尝试安装本地已存在的 skill
- **THEN** 提示 "该 skill 已安装"，提供"更新到最新版本"选项
