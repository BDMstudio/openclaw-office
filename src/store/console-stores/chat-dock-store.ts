import { create } from "zustand";
import type { GatewayAdapter } from "@/gateway/adapter";
import { getAdapter } from "@/gateway/adapter-provider";
import type {
  ChatAttachment,
  ChatContentBlock,
  ChatHistoryResult,
  SessionInfo,
  ToolCallInfo,
} from "@/gateway/adapter-types";
import type { AgentEventPayload, GatewayEventFrame } from "@/gateway/types";
import i18n from "@/i18n";
import { exportChatTranscriptMarkdown } from "@/lib/chat-export";
import { buildSlashHelpText, parseSlashCommand } from "@/lib/chat-slash-commands";
import { localPersistence } from "@/lib/local-persistence";
import { generateMessageId } from "@/lib/message-utils";

export type MessageRole = "user" | "assistant" | "system";
export type ChatMessageKind = "message" | "tool" | "command";

export interface ChatQueueItem {
  id: string;
  text: string;
  attachments: ChatAttachment[];
  createdAt: number;
}

export interface ChatDockMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
  toolCalls?: ToolCallInfo[];
  kind?: ChatMessageKind;
  runId?: string | null;
  aborted?: boolean;
}

interface ChatDockState {
  messages: ChatDockMessage[];
  isStreaming: boolean;
  currentSessionKey: string;
  dockExpanded: boolean;
  targetAgentId: string | null;
  sessions: SessionInfo[];
  error: string | null;
  activeRunId: string | null;
  streamingMessage: Record<string, unknown> | null;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;
  draft: string;
  attachments: ChatAttachment[];
  queue: ChatQueueItem[];
  focusMode: boolean;
  searchQuery: string;
  pinnedMessageIds: string[];
  thinkingLevel: string | null;

  sendMessage: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  abort: () => Promise<void>;
  toggleDock: () => void;
  setDockExpanded: (expanded: boolean) => void;
  switchSession: (key: string) => void;
  newSession: (agentId?: string | null) => void;
  loadSessions: () => Promise<void>;
  loadHistory: () => Promise<void>;
  initializeHistory: () => Promise<void>;
  setTargetAgent: (agentId: string) => void;
  handleChatEvent: (event: Record<string, unknown>) => void;
  handleAgentEvent: (event: AgentEventPayload) => void;
  clearError: () => void;
  initEventListeners: (
    wsClient: {
      onEvent: (name: string, handler: (frame: GatewayEventFrame) => void) => () => void;
    } | null,
  ) => () => void;
  setDraft: (draft: string) => void;
  addAttachment: (attachment: ChatAttachment) => void;
  removeAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;
  clearMessages: () => Promise<void>;
  setFocusMode: (focusMode: boolean) => void;
  setSearchQuery: (query: string) => void;
  togglePinMessage: (messageId: string) => void;
  exportCurrentSession: () => boolean;
}

function buildSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

const SESSION_LIST_CACHE_MAX_AGE_MS = 60_000;

function inferAgentIdFromSessionKey(sessionKey: string): string | null {
  const match = /^agent:([^:]+):/u.exec(sessionKey);
  return match?.[1] ?? null;
}

function resolveSessionAgentId(sessionKey: string, sessions: SessionInfo[]): string | null {
  const session = sessions.find((item) => item.key === sessionKey);
  return session?.agentId ?? inferAgentIdFromSessionKey(sessionKey);
}

function selectPreferredSessionKey(agentId: string, sessions: SessionInfo[]): string {
  const matched = sessions
    .filter((session) => resolveSessionAgentId(session.key, sessions) === agentId)
    .sort((a, b) => {
      const aTime = a.lastActiveAt ?? a.updatedAt ?? a.createdAt ?? 0;
      const bTime = b.lastActiveAt ?? b.updatedAt ?? b.createdAt ?? 0;
      return bTime - aTime;
    });
  return matched[0]?.key ?? buildSessionKey(agentId);
}

function mergeCurrentSession(
  sessions: SessionInfo[],
  currentSessionKey: string,
  targetAgentId: string | null,
): SessionInfo[] {
  if (sessions.some((session) => session.key === currentSessionKey)) {
    return sessions;
  }

  const now = Date.now();
  return [
    normalizeSession({
      key: currentSessionKey,
      agentId: targetAgentId ?? inferAgentIdFromSessionKey(currentSessionKey) ?? undefined,
      label: currentSessionKey,
      createdAt: now,
      lastActiveAt: now,
      messageCount: 0,
    }),
    ...sessions,
  ];
}

function touchSession(
  sessions: SessionInfo[],
  currentSessionKey: string,
  targetAgentId: string | null,
  messageCount: number,
): SessionInfo[] {
  const now = Date.now();
  const existing = sessions.find((session) => session.key === currentSessionKey);
  const nextSession = normalizeSession({
    ...existing,
    key: currentSessionKey,
    agentId: targetAgentId ?? existing?.agentId ?? inferAgentIdFromSessionKey(currentSessionKey) ?? undefined,
    label: existing?.label ?? currentSessionKey,
    createdAt: existing?.createdAt ?? now,
    lastActiveAt: now,
    updatedAt: now,
    messageCount,
  });
  return [
    nextSession,
    ...sessions.filter((session) => session.key !== currentSessionKey),
  ];
}

function persistSessions(sessions: SessionInfo[]): void {
  void localPersistence.saveSessions(sessions);
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is Extract<ChatContentBlock, { type: "text" }> =>
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          typeof block.text === "string",
      )
      .map((block) => block.text)
      .join("\n");
  }
  return "";
}

function normalizeRole(role: unknown): MessageRole {
  return role === "user" || role === "assistant" || role === "system" ? role : "assistant";
}

function isAttachmentLike(value: unknown): value is ChatAttachment {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ChatAttachment).mimeType === "string",
  );
}

function normalizeAttachment(attachment: ChatAttachment): ChatAttachment {
  return {
    id: attachment.id ?? generateMessageId(),
    name: attachment.name,
    mimeType: attachment.mimeType,
    dataUrl: attachment.dataUrl,
    content: attachment.content,
  };
}

function extractAttachments(message: Record<string, unknown>): ChatAttachment[] {
  if (Array.isArray(message.attachments)) {
    return message.attachments.filter(isAttachmentLike).map(normalizeAttachment);
  }
  if (Array.isArray(message.content)) {
    return message.content
      .flatMap((block) => {
        if (!block || typeof block !== "object") return [];
        const record = block as Record<string, unknown>;
        if (record.type !== "image") return [];
        return [
          normalizeAttachment({
            id: String(record.id ?? generateMessageId()),
            mimeType:
              typeof record.mimeType === "string"
                ? record.mimeType
                : typeof record.media_type === "string"
                  ? record.media_type
                  : "image/png",
            dataUrl:
              typeof record.dataUrl === "string"
                ? record.dataUrl
                : typeof record.url === "string"
                  ? record.url
                  : undefined,
          }),
        ];
      })
      .filter(Boolean);
  }
  return [];
}

function normalizeHistoryMessage(message: Record<string, unknown>): ChatDockMessage {
  return {
    id: String(message.id ?? generateMessageId()),
    role: normalizeRole(message.role),
    content: extractText(message.content ?? message.text ?? ""),
    timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
    attachments: extractAttachments(message),
    toolCalls: Array.isArray(message.toolCalls) ? (message.toolCalls as ToolCallInfo[]) : undefined,
    runId: typeof message.runId === "string" ? message.runId : null,
    aborted: Boolean(message.aborted),
  };
}

function normalizeSession(session: SessionInfo): SessionInfo {
  return {
    ...session,
    label: session.label ?? session.key,
    lastActiveAt: session.lastActiveAt ?? session.updatedAt ?? Date.now(),
    messageCount: session.messageCount ?? 0,
  };
}

function buildSystemMessage(content: string, kind: ChatMessageKind = "command"): ChatDockMessage {
  return {
    id: generateMessageId(),
    role: "system",
    content,
    timestamp: Date.now(),
    kind,
  };
}

async function withAdapter<T>(fn: (adapter: GatewayAdapter) => Promise<T>): Promise<T> {
  const adapter = getAdapter();
  return fn(adapter);
}

// Ensure IndexedDB is opened at module load (non-blocking)
localPersistence.open().catch(() => {});

async function executeSlashCommand(
  commandText: string,
  state: ChatDockState,
  set: (partial: Partial<ChatDockState> | ((state: ChatDockState) => Partial<ChatDockState>)) => void,
  get: () => ChatDockState,
): Promise<boolean> {
  const parsed = parseSlashCommand(commandText);
  if (!parsed) {
    return false;
  }

  const { command, args } = parsed;
  const sessionKey = state.currentSessionKey;

  const appendSystemMessage = async (content: string) => {
    const systemMessage = buildSystemMessage(content);
    set((current) => ({ messages: [...current.messages, systemMessage] }));
    await localPersistence.saveMessage(sessionKey, systemMessage);
  };

  switch (command.name) {
    case "help":
      await appendSystemMessage(buildSlashHelpText());
      return true;
    case "new":
      get().newSession();
      await appendSystemMessage(i18n.t("chat:slash.feedback.newSession"));
      return true;
    case "reset":
      try {
        await withAdapter((adapter) => adapter.sessionsReset(sessionKey));
      } catch {
        // Continue with local reset for older gateways.
      }
      await get().clearMessages();
      set({
        draft: "",
        attachments: [],
        isStreaming: false,
        activeRunId: null,
        streamingMessage: null,
      });
      await appendSystemMessage(i18n.t("chat:slash.feedback.reset"));
      return true;
    case "stop":
      await get().abort();
      await appendSystemMessage(i18n.t("chat:slash.feedback.stop"));
      return true;
    case "clear":
      await get().clearMessages();
      return true;
    case "focus":
      set((current) => ({ focusMode: !current.focusMode }));
      await appendSystemMessage(
        i18n.t(get().focusMode ? "chat:slash.feedback.focusEnabled" : "chat:slash.feedback.focusDisabled"),
      );
      return true;
    case "export":
      if (get().exportCurrentSession()) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.exported"));
      } else {
        await appendSystemMessage(i18n.t("chat:slash.feedback.exportUnavailable"));
      }
      return true;
    case "agents": {
      try {
        const result = await withAdapter((adapter) => adapter.agentsList());
        const agentLines = result.agents.map((agent) => `- \`${agent.id}\` — ${agent.name}`);
        await appendSystemMessage([`**${i18n.t("chat:slash.feedback.availableAgents")}**`, "", ...agentLines].join("\n"));
      } catch (error) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.agentsLoadFailed", { error: String(error) }),
        );
      }
      return true;
    }
    case "model": {
      if (!args) {
        const activeSession = get().sessions.find((session) => session.key === sessionKey);
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.currentModel", {
            model: activeSession?.model ?? "default",
            providerSuffix: activeSession?.modelProvider
              ? i18n.t("common:format.viaValue", { value: `\`${activeSession.modelProvider}\`` })
              : "",
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { model: args }));
        set((current) => ({
          sessions: current.sessions.map((session) =>
            session.key === sessionKey ? { ...session, model: args } : session,
          ),
        }));
        await appendSystemMessage(i18n.t("chat:slash.feedback.modelSet", { model: args }));
      } catch (error) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.modelSetFailed", { error: String(error) }));
      }
      return true;
    }
    case "think": {
      if (!args) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.currentThinking", {
            level: get().thinkingLevel ?? "default",
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { thinkingLevel: args }));
        set({ thinkingLevel: args });
        await appendSystemMessage(i18n.t("chat:slash.feedback.thinkingSet", { level: args }));
      } catch (error) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.thinkingSetFailed", { error: String(error) }),
        );
      }
      return true;
    }
    case "verbose": {
      if (!args) {
        const activeSession = get().sessions.find((session) => session.key === sessionKey);
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.currentVerbose", {
            level: activeSession?.verboseLevel ?? "off",
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { verboseLevel: args }));
        await appendSystemMessage(i18n.t("chat:slash.feedback.verboseSet", { level: args }));
      } catch (error) {
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.verboseSetFailed", { error: String(error) }),
        );
      }
      return true;
    }
    case "fast": {
      if (!args || args === "status") {
        const activeSession = get().sessions.find((session) => session.key === sessionKey);
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.fastStatus", {
            enabled: activeSession?.fastMode
              ? i18n.t("chat:state.enabled")
              : i18n.t("chat:state.disabled"),
          }),
        );
        return true;
      }
      try {
        await withAdapter((adapter) => adapter.sessionsPatch(sessionKey, { fastMode: args === "on" }));
        await appendSystemMessage(
          i18n.t("chat:slash.feedback.fastSet", {
            enabled: args === "on" ? i18n.t("chat:state.enabled") : i18n.t("chat:state.disabled"),
          }),
        );
      } catch (error) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.fastSetFailed", { error: String(error) }));
      }
      return true;
    }
    case "compact":
      try {
        await withAdapter((adapter) => adapter.sessionsCompact(sessionKey));
        await appendSystemMessage(i18n.t("chat:slash.feedback.compactSuccess"));
      } catch (error) {
        await appendSystemMessage(i18n.t("chat:slash.feedback.compactFailed", { error: String(error) }));
      }
      return true;
    default:
      return false;
  }
}

export const useChatDockStore = create<ChatDockState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentSessionKey: "agent:main:main",
  dockExpanded: false,
  targetAgentId: null,
  sessions: [],
  error: null,
  activeRunId: null,
  streamingMessage: null,
  isHistoryLoaded: false,
  isHistoryLoading: false,
  draft: "",
  attachments: [],
  queue: [],
  focusMode: false,
  searchQuery: "",
  pinnedMessageIds: [],
  thinkingLevel: null,

  sendMessage: async (text, attachments) => {
    const trimmed = text.trim();
    const outboundAttachments = attachments ?? get().attachments;
    if (!trimmed && outboundAttachments.length === 0) return;

    const slashHandled = await executeSlashCommand(trimmed, get(), set, get);
    if (slashHandled) {
      set({ draft: "", attachments: [] });
      return;
    }

    if (get().isStreaming) {
      set((state) => ({
        queue: [
          ...state.queue,
          {
            id: generateMessageId(),
            text: trimmed,
            attachments: outboundAttachments,
            createdAt: Date.now(),
          },
        ],
        draft: "",
        attachments: [],
      }));
      return;
    }

    const { currentSessionKey } = get();
    const userMsg: ChatDockMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
      attachments: outboundAttachments.length > 0 ? outboundAttachments : undefined,
    };

    const nextSessions = touchSession(
      get().sessions,
      currentSessionKey,
      get().targetAgentId,
      get().messages.length + 1,
    );

    set((state) => ({
      messages: [...state.messages, userMsg],
      sessions: nextSessions,
      isStreaming: true,
      dockExpanded: true,
      error: null,
      streamingMessage: null,
      draft: "",
      attachments: [],
    }));

    localPersistence.saveMessage(currentSessionKey, userMsg).catch(() => {});
    persistSessions(nextSessions);

    try {
      await withAdapter((adapter) =>
        adapter.chatSend({
          text: trimmed,
          sessionKey: currentSessionKey,
          attachments: outboundAttachments,
        }),
      );
    } catch (err) {
      set({
        error: String(err),
        isStreaming: false,
      });
    }
  },

  abort: async () => {
    const { currentSessionKey } = get();
    set({
      isStreaming: false,
      streamingMessage: null,
    });

    try {
      await withAdapter((adapter) => adapter.chatAbort(currentSessionKey));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  toggleDock: () => {
    set((state) => ({ dockExpanded: !state.dockExpanded }));
  },

  setDockExpanded: (expanded) => {
    set({ dockExpanded: expanded });
  },

  switchSession: (key) => {
    const targetAgentId = resolveSessionAgentId(key, get().sessions);
    set({
      currentSessionKey: key,
      targetAgentId,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: false,
      draft: "",
      attachments: [],
      queue: [],
    });
    void get().initializeHistory();
  },

  newSession: (agentId) => {
    const resolvedAgentId = agentId ?? get().targetAgentId ?? "main";
    const newKey = `agent:${resolvedAgentId}:session-${Date.now()}`;
    const sessions = [
      {
        key: newKey,
        agentId: resolvedAgentId,
        label: newKey,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 0,
      },
      ...get().sessions.filter((session) => session.key !== newKey),
    ].map(normalizeSession);
    set({
      currentSessionKey: newKey,
      targetAgentId: resolvedAgentId,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: true,
      isHistoryLoading: false,
      draft: "",
      attachments: [],
      queue: [],
      thinkingLevel: null,
      sessions,
    });
    void localPersistence.clearMessages(newKey);
    persistSessions(sessions);
  },

  loadSessions: async () => {
    const current = get();
    const cached = await localPersistence.getSessions();
    if (cached.sessions.length > 0) {
      set({
        sessions: mergeCurrentSession(cached.sessions.map(normalizeSession), current.currentSessionKey, current.targetAgentId),
      });
      if (cached.cachedAt && Date.now() - cached.cachedAt < SESSION_LIST_CACHE_MAX_AGE_MS) {
        return;
      }
    }

    try {
      const result = await withAdapter((adapter) => adapter.sessionsList());
      const normalized = result.map(normalizeSession);
      const merged = mergeCurrentSession(normalized, get().currentSessionKey, get().targetAgentId);
      set({ sessions: merged });
      persistSessions(merged);
    } catch {
      // Sessions are optional for basic chat usage.
    }
  },

  loadHistory: async () => {
    const { currentSessionKey } = get();
    try {
      const result = await withAdapter((adapter) => adapter.chatHistory(currentSessionKey));
      const messages = result.messages.map((message) =>
        normalizeHistoryMessage(message as unknown as Record<string, unknown>),
      );
      const nextSessions = touchSession(get().sessions, currentSessionKey, get().targetAgentId, messages.length);
      set({ messages, thinkingLevel: result.thinkingLevel ?? null, sessions: nextSessions });
      await localPersistence.saveMessages(currentSessionKey, messages);
      persistSessions(nextSessions);
    } catch {
      set({ messages: [] });
    }
  },

  initializeHistory: async () => {
    const { currentSessionKey } = get();
    set({ isHistoryLoading: true });
    try {
      const result: ChatHistoryResult = await withAdapter((adapter) =>
        adapter.chatHistory(currentSessionKey),
      );
      const messages = result.messages.map((message) =>
        normalizeHistoryMessage(message as unknown as Record<string, unknown>),
      );
      const nextSessions = touchSession(get().sessions, currentSessionKey, get().targetAgentId, messages.length);
      set({
        messages,
        sessions: nextSessions,
        isHistoryLoaded: true,
        isHistoryLoading: false,
        thinkingLevel: result.thinkingLevel ?? null,
      });
      await localPersistence.saveMessages(currentSessionKey, messages);
      persistSessions(nextSessions);
    } catch {
      try {
        const cached = await localPersistence.getMessages(currentSessionKey);
        set({ messages: cached, isHistoryLoaded: true, isHistoryLoading: false });
      } catch {
        set({ messages: [], isHistoryLoaded: true, isHistoryLoading: false });
      }
    }
  },

  setTargetAgent: (agentId) => {
    const sessionKey = selectPreferredSessionKey(agentId, get().sessions);
    set({
      targetAgentId: agentId,
      currentSessionKey: sessionKey,
      messages: [],
      streamingMessage: null,
      activeRunId: null,
      error: null,
      isStreaming: false,
      isHistoryLoaded: false,
    });
    void get().initializeHistory();
  },

  handleChatEvent: (event) => {
    const eventSessionKey =
      typeof event.sessionKey === "string" && event.sessionKey.length > 0
        ? event.sessionKey
        : get().currentSessionKey;
    if (eventSessionKey !== get().currentSessionKey) {
      return;
    }

    const eventState = String(event.state || "");
    const runId = String(event.runId || "");
    const message = event.message as Record<string, unknown> | undefined;

    let resolvedState = eventState;
    if (!resolvedState && message) {
      const stopReason = message.stopReason ?? message.stop_reason;
      if (stopReason) {
        resolvedState = "final";
      } else if (message.role || message.content) {
        resolvedState = "delta";
      }
    }

    switch (resolvedState) {
      case "delta": {
        if (message) {
          set({
            streamingMessage: message,
            activeRunId: runId || get().activeRunId,
            isStreaming: true,
          });
        }
        break;
      }
      case "final": {
        const assistantText = message ? extractText(message.content ?? message.text ?? "") : "";
        if (assistantText) {
          const assistantMsg: ChatDockMessage = {
            id: String(message?.id ?? generateMessageId()),
            role: "assistant",
            content: assistantText,
            timestamp: Date.now(),
            attachments: message ? extractAttachments(message) : undefined,
            toolCalls: Array.isArray(message?.toolCalls)
              ? (message.toolCalls as ToolCallInfo[])
              : undefined,
            runId: runId || null,
            aborted: Boolean(message?.aborted),
          };
          const nextSessions = touchSession(
            get().sessions,
            get().currentSessionKey,
            get().targetAgentId,
            get().messages.length + 1,
          );
          set((state) => ({
            messages: [...state.messages, assistantMsg],
            sessions: nextSessions,
            isStreaming: false,
            streamingMessage: null,
            activeRunId: null,
          }));
          const { currentSessionKey } = get();
          localPersistence.saveMessage(currentSessionKey, assistantMsg).catch(() => {});
          persistSessions(nextSessions);
        } else {
          set({
            isStreaming: false,
            streamingMessage: null,
            activeRunId: null,
          });
          void get().loadHistory();
        }
        const next = get().queue[0];
        if (next) {
          set((state) => ({ queue: state.queue.slice(1) }));
          void get().sendMessage(next.text, next.attachments);
        }
        break;
      }
      case "error": {
        const errorMsg = String(event.errorMessage || i18n.t("common:errors.errorOccurred"));
        set({
          error: errorMsg,
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
        });
        break;
      }
      case "aborted": {
        set({
          isStreaming: false,
          streamingMessage: null,
          activeRunId: null,
        });
        void get().loadHistory();
        const next = get().queue[0];
        if (next) {
          set((state) => ({ queue: state.queue.slice(1) }));
          void get().sendMessage(next.text, next.attachments);
        }
        break;
      }
      default: {
        if (get().isStreaming && message) {
          set({ streamingMessage: message });
        }
      }
    }
  },

  handleAgentEvent: (event) => {
    if (event.sessionKey && event.sessionKey !== get().currentSessionKey) {
      return;
    }
    if (event.stream !== "tool") {
      return;
    }
    const phase = typeof event.data.phase === "string" ? event.data.phase : "";
    const name = typeof event.data.name === "string" ? event.data.name : "unknown";
    const args = event.data.args as Record<string, unknown> | undefined;
    const toolCallStatus = phase === "start" ? "running" : "done";
    const systemMessage: ChatDockMessage =
      phase === "start"
        ? {
            ...buildSystemMessage(i18n.t("chat:toolActivity.calling", { name }), "tool"),
            runId: event.runId,
            toolCalls: [
              {
                id: `${event.runId}:${event.seq}`,
                name,
                args,
                status: toolCallStatus,
              },
            ],
          }
        : {
            ...buildSystemMessage(i18n.t("chat:toolActivity.finished", { name }), "tool"),
            runId: event.runId,
            toolCalls: [
              {
                id: `${event.runId}:${event.seq}`,
                name,
                args,
                status: toolCallStatus,
              },
            ],
          };
    set((state) => ({
      messages: [...state.messages, systemMessage],
    }));
  },

  clearError: () => set({ error: null }),

  initEventListeners: (wsClient) => {
    if (!wsClient) return () => {};

    const unsubChat = wsClient.onEvent("chat", (frame: GatewayEventFrame) => {
      const payload = frame.payload as Record<string, unknown>;
      get().handleChatEvent(payload);
    });
    const unsubAgent = wsClient.onEvent("agent", (frame: GatewayEventFrame) => {
      get().handleAgentEvent(frame.payload as AgentEventPayload);
    });

    return () => {
      unsubChat();
      unsubAgent();
    };
  },

  setDraft: (draft) => set({ draft }),

  addAttachment: (attachment) =>
    set((state) => ({
      attachments: [...state.attachments, normalizeAttachment(attachment)],
    })),

  removeAttachment: (attachmentId) =>
    set((state) => ({
      attachments: state.attachments.filter((attachment) => attachment.id !== attachmentId),
    })),

  clearAttachments: () => set({ attachments: [] }),

  clearMessages: async () => {
    const { currentSessionKey } = get();
    set({ messages: [] });
    await localPersistence.clearMessages(currentSessionKey);
  },

  setFocusMode: (focusMode) => set({ focusMode }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  togglePinMessage: (messageId) =>
    set((state) => ({
      pinnedMessageIds: state.pinnedMessageIds.includes(messageId)
        ? state.pinnedMessageIds.filter((id) => id !== messageId)
        : [...state.pinnedMessageIds, messageId],
    })),

  exportCurrentSession: () => exportChatTranscriptMarkdown(get().messages, get().currentSessionKey),
}));
