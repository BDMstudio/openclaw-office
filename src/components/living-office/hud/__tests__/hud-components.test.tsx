import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectionStore } from "@/perception/projection-store";
import { useOfficeStore } from "@/store/office-store";
import { GatewayStatus } from "../GatewayStatus";
import { StatsPanel } from "../StatsPanel";
import { EventLogPanel } from "../EventLogPanel";
import { HudBar } from "../HudBar";
import { EventTicker } from "../EventTicker";

describe("HudBar", () => {
  it("renders three slots", () => {
    const { container } = render(
      <div className="living-office">
        <HudBar left={<div>Left</div>} center={<div>Center</div>} right={<div>Right</div>} />
      </div>,
    );
    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Center")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
    const grid = container.querySelector("[style*='grid']");
    expect(grid).toBeTruthy();
  });
});

describe("GatewayStatus", () => {
  beforeEach(() => {
    useOfficeStore.setState({ connectionStatus: "connected" });
    useProjectionStore.setState({
      sceneArea: {
        gatewayStream: [
          { label: "WebSocket", detail: "连接中", active: false },
          { label: "Event Bus", detail: "就绪", active: true },
        ],
        cronTasks: [],
        memoryItems: [],
        projectTasks: [],
        opsRules: [],
      },
    });
  });

  it("shows online status when connected", () => {
    render(
      <div className="living-office">
        <GatewayStatus />
      </div>,
    );
    expect(screen.getByText("WS 在线")).toBeInTheDocument();
    expect(screen.getByText("Gateway 中控大厅")).toBeInTheDocument();
  });

  it("shows offline status when disconnected", () => {
    useOfficeStore.setState({ connectionStatus: "disconnected" });
    render(
      <div className="living-office">
        <GatewayStatus />
      </div>,
    );
    expect(screen.getByText("WS 断开")).toBeInTheDocument();
  });

  it("renders gateway stream lines", () => {
    render(
      <div className="living-office">
        <GatewayStatus />
      </div>,
    );
    expect(screen.getByText("WebSocket")).toBeInTheDocument();
    expect(screen.getByText("Event Bus")).toBeInTheDocument();
  });
});

describe("StatsPanel", () => {
  beforeEach(() => {
    useProjectionStore.setState({
      agents: new Map([
        ["a1", { agentId: "a1", role: "main", state: "WORKING", deskId: "d1", load: 0, lastHeartbeatAt: Date.now(), health: "ok" }],
        ["a2", { agentId: "a2", role: "coder", state: "IDLE", deskId: "d2", load: 0, lastHeartbeatAt: Date.now(), health: "ok" }],
      ]),
      sceneArea: {
        gatewayStream: [],
        cronTasks: [{ time: "14:00", name: "test", status: "running" }],
        memoryItems: [],
        projectTasks: [],
        opsRules: [],
      },
    });
  });

  it("shows active agent count", () => {
    render(
      <div className="living-office">
        <StatsPanel />
      </div>,
    );
    expect(screen.getByText("运行指标")).toBeInTheDocument();
    expect(screen.getAllByText("活跃").length).toBeGreaterThan(0);
  });

  it("shows cron task count", () => {
    render(
      <div className="living-office">
        <StatsPanel />
      </div>,
    );
    expect(screen.getAllByText("Cron").length).toBeGreaterThan(0);
  });
});

describe("EventLogPanel", () => {
  it("shows empty state when no logs", () => {
    useProjectionStore.setState({ narrativeLogs: [] });
    render(
      <div className="living-office">
        <EventLogPanel />
      </div>,
    );
    expect(screen.getByText("等待事件…")).toBeInTheDocument();
  });

  it("renders narrative logs", () => {
    useProjectionStore.setState({
      narrativeLogs: [
        { ts: Date.now(), text: "客户消息到达 Sales Agent", level: 4, kind: "ARRIVE" },
      ],
    });
    render(
      <div className="living-office">
        <EventLogPanel />
      </div>,
    );
    expect(screen.getByText("客户消息到达 Sales Agent")).toBeInTheDocument();
  });
});

describe("EventTicker", () => {
  it("renders fallback items when few logs", () => {
    useProjectionStore.setState({ narrativeLogs: [] });
    render(
      <div className="living-office">
        <EventTicker />
      </div>,
    );
    expect(screen.getByText("事件流转叙事")).toBeInTheDocument();
    expect(screen.getAllByText("客户消息到达").length).toBeGreaterThan(0);
  });
});
