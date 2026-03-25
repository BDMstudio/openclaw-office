# Chat Parity Review

This document maps the `replicate-control-ui-chat` implementation in OpenClaw Office to the upstream OpenClaw Control UI chat references.

## Upstream References

- `../openclaw/ui/src/ui/views/chat.ts`
- `../openclaw/ui/src/ui/controllers/chat.ts`
- `../openclaw/ui/src/ui/app-chat.ts`
- `../openclaw/docs/web/control-ui.md`

## Scope

This project replicates upstream chat behavior, not the upstream Lit UI. OpenClaw Office keeps its own React, Zustand, Tailwind, and route/layout system while matching the operator-visible workflow where the Gateway contract allows it.

## Parity Matrix

| Upstream capability | Upstream reference | Office implementation | Status |
| --- | --- | --- | --- |
| Dedicated chat page and page-level navigation | `views/chat.ts`, `app-chat.ts` | `/chat` route, top-menu Chat entry, page tracking in [`src/App.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/App.tsx), [`src/components/layout/TopBar.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/layout/TopBar.tsx), [`src/components/pages/ChatPage.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/pages/ChatPage.tsx) | Implemented |
| Shared chat workspace state across entry points | `app-chat.ts` | Shared Zustand workspace in [`src/store/console-stores/chat-dock-store.ts`](/Users/liuxingwang/go/src/OpenClaw-Office/src/store/console-stores/chat-dock-store.ts), consumed by page, dock, and dialog | Implemented |
| Session list, active session switching, new session flow | `views/chat.ts`, `app-chat.ts` | [`src/components/chat/SessionSwitcher.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/chat/SessionSwitcher.tsx) plus workspace actions `loadSessions`, `switchSession`, `newSession` | Implemented |
| Agent-targeted session routing | `views/chat.ts`, `app-chat.ts` | [`src/components/chat/AgentSelector.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/chat/AgentSelector.tsx) plus `setTargetAgent` in shared workspace store | Implemented |
| Live streaming assistant output | `controllers/chat.ts`, `views/chat.ts` | `handleChatEvent` plus streaming transcript rendering in [`src/components/pages/ChatPage.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/pages/ChatPage.tsx) | Implemented |
| Final message reconciliation and history reload fallback | `controllers/chat.ts`, `app-chat.ts` | Final/abort handling in [`src/store/console-stores/chat-dock-store.ts`](/Users/liuxingwang/go/src/OpenClaw-Office/src/store/console-stores/chat-dock-store.ts) | Implemented |
| Abort with partial-output preservation | `controllers/chat.ts` | `abort`, `handleChatEvent("aborted")`, and `loadHistory` reload the active transcript after abort | Implemented |
| Tool activity visible in transcript | `views/chat.ts`, `app-chat.ts` | Agent `tool` events normalized into system/tool transcript messages and rendered by [`src/components/chat/MessageBubble.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/chat/MessageBubble.tsx) | Implemented |
| Outbound queueing while a run is active | `app-chat.ts` | Shared `queue` handling in [`src/store/console-stores/chat-dock-store.ts`](/Users/liuxingwang/go/src/OpenClaw-Office/src/store/console-stores/chat-dock-store.ts) | Implemented |
| Attachment-aware sending | `controllers/chat.ts`, `views/chat.ts` | Attachment UI in page/dock/dialog plus adapter payload conversion in [`src/gateway/ws-adapter.ts`](/Users/liuxingwang/go/src/OpenClaw-Office/src/gateway/ws-adapter.ts) | Implemented for image attachments |
| Slash-command entry and local command execution | `views/chat.ts`, `app-chat.ts` | Command catalog in [`src/lib/chat-slash-commands.ts`](/Users/liuxingwang/go/src/OpenClaw-Office/src/lib/chat-slash-commands.ts) and execution in shared workspace store | Implemented for Office-supported commands |
| Search, export, focus mode, pinned references | `views/chat.ts` | [`src/components/pages/ChatPage.tsx`](/Users/liuxingwang/go/src/OpenClaw-Office/src/components/pages/ChatPage.tsx), [`src/lib/chat-export.ts`](/Users/liuxingwang/go/src/OpenClaw-Office/src/lib/chat-export.ts) | Implemented |
| Localized runtime strings | `views/chat.ts` plus Control UI locale layer | zh/en strings added under [`src/i18n/locales/en/chat.json`](/Users/liuxingwang/go/src/OpenClaw-Office/src/i18n/locales/en/chat.json) and [`src/i18n/locales/zh/chat.json`](/Users/liuxingwang/go/src/OpenClaw-Office/src/i18n/locales/zh/chat.json) | Implemented |

## Contract Gaps Audited During Implementation

The upstream UI expects richer chat/session/runtime payloads than Office originally exposed. The following gaps were closed in the adapter layer rather than in UI components:

1. Chat history is no longer treated as plain `string` content only.
   Office now accepts richer content blocks, attachment metadata, stop reasons, and aborted markers.
2. Session rows now expose chat-relevant runtime settings.
   Office added optional model, thinking level, verbose level, and fast mode fields where available.
3. Session mutation RPCs required by slash commands were missing.
   Office added `sessions.patch`, `sessions.reset`, and `sessions.compact` adapter methods.
4. Attachment sends required normalized payload conversion.
   Office converts browser `data:` URLs into upstream-compatible base64 payloads before `chat.send`.
5. Mock mode did not previously exercise queueing, tool activity, or attachment-aware messages.
   The mock adapter now emits richer `chat` and `agent` events to cover those paths.

## Intentional Bounds

The following upstream-adjacent behaviors are intentionally not claimed as full parity in this change:

1. Lit-specific layout, sidebar rendering, and component structure were not copied.
2. Speech-to-text was not ported into Office.
3. The slash-command matrix is bounded to commands supported by current Office APIs and adapter coverage.
4. Attachment support is currently limited to image attachments that can be represented as browser `data:` URLs and accepted by the current Gateway contract.

## Review Checklist

Use this checklist during implementation review:

1. Confirm `/chat` is reachable from the top menu and preserves active session state when leaving and returning.
2. Confirm session switching, new session creation, and agent targeting all operate on the shared workspace state.
3. Confirm streaming, final, error, and aborted chat events reconcile correctly into transcript state.
4. Confirm tool events render distinctly from assistant prose.
5. Confirm slash commands only claim behavior backed by Office adapter APIs.
6. Confirm zh/en locale files cover page labels, runtime feedback, tool states, and command descriptions.
7. Confirm real Gateway testing succeeds with the local `../openclaw` environment, not only mock mode.
