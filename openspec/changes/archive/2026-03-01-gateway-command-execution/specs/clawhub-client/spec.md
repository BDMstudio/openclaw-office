## ADDED Requirements

### Requirement: ClawHub API 客户端模块

系统 SHALL 提供 `src/gateway/clawhub-client.ts` 模块，封装对 ClawHub Registry REST API 的调用。

API 基础地址 SHALL 默认为 `https://clawhub.ai`，可通过 `VITE_CLAWHUB_REGISTRY` 环境变量覆盖。

#### Scenario: 默认 registry URL
- **WHEN** 未设置 `VITE_CLAWHUB_REGISTRY`
- **THEN** 使用 `https://clawhub.ai` 作为 API 基础地址

#### Scenario: 自定义 registry URL
- **WHEN** 设置 `VITE_CLAWHUB_REGISTRY=https://custom-registry.example.com`
- **THEN** 使用该自定义地址

### Requirement: ClawHub 搜索 API

`clawhubSearch(query: string, limit?: number)` SHALL 调用 `GET /api/v1/search` 端点，返回语义搜索结果。

返回类型 `ClawHubSearchResult[]`：
```typescript
interface ClawHubSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary: string | null;
  version: string | null;
  updatedAt: number;
}
```

#### Scenario: 搜索 pptx 相关 skills
- **WHEN** 调用 `clawhubSearch("pptx", 10)`
- **THEN** 返回最多 10 个结果，每个包含 `slug`、`displayName`、`score`
- **THEN** 结果按 `score` 降序排列

#### Scenario: 搜索无结果
- **WHEN** 搜索词无匹配
- **THEN** 返回空数组 `[]`

#### Scenario: API 错误处理
- **WHEN** ClawHub API 返回非 200 状态码或网络错误
- **THEN** 抛出 `ClawHubError`，包含 `code` 和 `message`

### Requirement: ClawHub 浏览 API

`clawhubExplore(options?: { limit?: number; cursor?: string })` SHALL 调用 `GET /api/v1/skills` 端点，返回最新 skills 列表。

返回类型 `ClawHubExploreResponse`：
```typescript
interface ClawHubSkillListItem {
  slug: string;
  displayName: string;
  summary: string | null;
  tags: Record<string, string>;
  stats: {
    downloads: number;
    installsAllTime: number;
    installsCurrent: number;
    stars: number;
    versions: number;
  };
  createdAt: number;
  updatedAt: number;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog: string;
  };
}

interface ClawHubExploreResponse {
  items: ClawHubSkillListItem[];
  nextCursor: string | null;
}
```

#### Scenario: 浏览最新 skills
- **WHEN** 调用 `clawhubExplore({ limit: 20 })`
- **THEN** 返回最多 20 个 skills，按更新时间倒序
- **THEN** 如有更多页，返回 `nextCursor` 非 null

#### Scenario: 分页加载
- **WHEN** 用上一次返回的 `nextCursor` 调用 `clawhubExplore({ cursor: "xxx" })`
- **THEN** 返回下一页数据

### Requirement: ClawHub Skill 详情 API

`clawhubSkillDetail(slug: string)` SHALL 调用 `GET /api/v1/skills/:slug` 端点，返回 skill 完整信息。

返回类型 `ClawHubSkillDetail`：
```typescript
interface ClawHubSkillDetail {
  skill: {
    slug: string;
    displayName: string;
    summary: string | null;
    tags: Record<string, string>;
    stats: ClawHubSkillStats;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion: {
    version: string;
    createdAt: number;
    changelog: string;
  } | null;
  owner: {
    handle: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
}
```

#### Scenario: 获取 powerpoint-pptx 详情
- **WHEN** 调用 `clawhubSkillDetail("powerpoint-pptx")`
- **THEN** 返回包含 owner（handle、avatar）、stats（downloads、stars）、latestVersion 的完整信息

#### Scenario: 不存在的 skill
- **WHEN** 调用 `clawhubSkillDetail("nonexistent-slug")`
- **THEN** 返回 `skill: null`

### Requirement: ClawHub API 限流与缓存

客户端 SHALL 实现以下保护机制：

1. 搜索请求 SHALL 做 debounce（至少 300ms）
2. 浏览列表结果 SHALL 在内存中缓存 60 秒
3. Skill 详情 SHALL 在内存中缓存 5 分钟
4. 遇到 Rate Limit 错误时 SHALL 向用户展示友好提示

#### Scenario: 搜索 debounce
- **WHEN** 用户快速输入 "p", "pp", "ppt", "pptx"
- **THEN** 仅在输入稳定 300ms 后发起一次搜索请求

#### Scenario: Rate Limit 处理
- **WHEN** ClawHub API 返回 Rate Limit 错误
- **THEN** 展示 "搜索服务繁忙，请稍后重试" 提示
- **THEN** 自动在 5 秒后允许重试
