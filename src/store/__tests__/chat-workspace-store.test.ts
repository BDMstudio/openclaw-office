import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAdapterForTests, getAdapter, initAdapter } from "@/gateway/adapter-provider";
import { localPersistence } from "@/lib/local-persistence";
import { useChatDockStore } from "../console-stores/chat-dock-store";

function resetChatStore() {
  useChatDockStore.setState({
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
  });
}

describe("Chat workspace store", () => {
  beforeEach(async () => {
    __resetAdapterForTests();
    await initAdapter("mock");
    vi.restoreAllMocks();
    resetChatStore();
  });

  it("initializes history with thinking level and messages", async () => {
    await useChatDockStore.getState().initializeHistory();
    const state = useChatDockStore.getState();
    expect(state.messages.length).toBeGreaterThan(0);
    expect(state.thinkingLevel).toBe("medium");
    expect(state.isHistoryLoaded).toBe(true);
  });

  it("creates a new session and keeps it active", () => {
    useChatDockStore.getState().newSession("main");
    const state = useChatDockStore.getState();
    expect(state.currentSessionKey).toContain("agent:main:session-");
    expect(state.sessions[0]?.key).toBe(state.currentSessionKey);
  });

  it("switches target agent when selecting a different session", () => {
    useChatDockStore.setState({
      sessions: [
        {
          key: "agent:coder:session-1",
          agentId: "coder",
          label: "coder",
          createdAt: 1,
          lastActiveAt: 2,
          messageCount: 3,
        },
      ],
    });

    useChatDockStore.getState().switchSession("agent:coder:session-1");

    const state = useChatDockStore.getState();
    expect(state.currentSessionKey).toBe("agent:coder:session-1");
    expect(state.targetAgentId).toBe("coder");
  });

  it("prefers an existing gateway session when changing the target agent", () => {
    useChatDockStore.setState({
      sessions: [
        {
          key: "agent:coder:session-old",
          agentId: "coder",
          label: "old",
          createdAt: 1,
          lastActiveAt: 10,
          messageCount: 2,
        },
        {
          key: "agent:coder:session-new",
          agentId: "coder",
          label: "new",
          createdAt: 2,
          lastActiveAt: 20,
          messageCount: 5,
        },
      ],
    });

    useChatDockStore.getState().setTargetAgent("coder");

    const state = useChatDockStore.getState();
    expect(state.targetAgentId).toBe("coder");
    expect(state.currentSessionKey).toBe("agent:coder:session-new");
  });

  it("uses cached session history before hitting gateway", async () => {
    vi.spyOn(localPersistence, "getSessions").mockResolvedValue({
      sessions: [
        {
          key: "agent:main:main",
          agentId: "main",
          label: "cached",
          createdAt: 1,
          lastActiveAt: Date.now(),
          messageCount: 7,
        },
      ],
      cachedAt: Date.now(),
    });
    const sessionsListSpy = vi.spyOn(getAdapter(), "sessionsList");

    await useChatDockStore.getState().loadSessions();

    expect(sessionsListSpy).not.toHaveBeenCalled();
    expect(useChatDockStore.getState().sessions[0]?.label).toBe("cached");
  });

  it("queues outbound messages while streaming", async () => {
    useChatDockStore.setState({ isStreaming: true });
    await useChatDockStore.getState().sendMessage("queued while busy");
    const state = useChatDockStore.getState();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0]?.text).toBe("queued while busy");
  });

  it("handles local slash commands through shared state", async () => {
    await useChatDockStore.getState().sendMessage("/focus");
    const state = useChatDockStore.getState();
    expect(state.focusMode).toBe(true);
    expect(state.messages.at(-1)?.content).toContain("专注模式");
  });

  it("records tool activity from agent events", () => {
    useChatDockStore.getState().handleAgentEvent({
      runId: "run-1",
      seq: 1,
      stream: "tool",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", name: "mock_search", args: { query: "hello" } },
    });
    const state = useChatDockStore.getState();
    expect(state.messages.at(-1)?.kind).toBe("tool");
    expect(state.messages.at(-1)?.toolCalls?.[0]?.name).toBe("mock_search");
  });
});
