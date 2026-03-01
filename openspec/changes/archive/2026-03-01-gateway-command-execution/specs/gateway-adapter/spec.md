## MODIFIED Requirements

### Requirement: skillsInstall 返回类型扩展

`GatewayAdapter.skillsInstall()` 的返回类型 SHALL 从 `{ ok: boolean; message: string }` 扩展为 `SkillInstallResult`：

```typescript
interface SkillInstallResult {
  ok: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  code?: number | null;
  warnings?: string[];
}
```

`WsAdapter` SHALL 透传 Gateway RPC `skills.install` 返回的所有字段。

`MockAdapter` SHALL 更新 `skillsInstall` 返回值以包含模拟的 `stdout` 和 `code` 字段。

#### Scenario: 真实安装返回完整结果
- **WHEN** 通过 `WsAdapter` 调用 `skillsInstall("playwright", "brew")`
- **WHEN** Gateway 返回 `{ ok: true, message: "Installed", stdout: "...", stderr: "", code: 0 }`
- **THEN** adapter 返回完整的 `SkillInstallResult`

#### Scenario: 安装失败返回错误详情
- **WHEN** Gateway 返回 `{ ok: false, message: "brew not found", stderr: "command not found: brew", code: 127 }`
- **THEN** adapter 返回完整的错误详情

#### Scenario: Mock 模式安装
- **WHEN** 使用 `MockAdapter` 调用 `skillsInstall`
- **THEN** 返回 `{ ok: true, message: "Mock install completed", stdout: "mock output", code: 0 }`

### Requirement: adapter-types.ts 类型更新

`adapter-types.ts` SHALL 导出以下新类型：

1. `SkillInstallResult` — 系统依赖安装结果
2. 原有的 `skillsInstall` 返回类型引用更新

#### Scenario: 类型可导入
- **WHEN** `skills-store.ts` 需要安装结果类型
- **THEN** 可从 `@/gateway/adapter-types` 导入 `SkillInstallResult`
