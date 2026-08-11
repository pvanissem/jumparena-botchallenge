import type {
  MatchDef,
  OutboundMessage,
  TournamentShowState,
  TournamentState,
} from "@arena/shared";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentPage, PresentStage } from "./PresentPage";

const connection = vi.hoisted(() => ({
  lastMessage: null as OutboundMessage | null,
  listeners: new Set<(message: OutboundMessage) => void>(),
  send: vi.fn(),
}));

let matchEngineStarts = 0;

function MatchViewLifecycleProbe({
  onProgress,
  onFinished,
}: {
  onProgress: unknown;
  onFinished: unknown;
}) {
  useEffect(() => {
    void onProgress;
    void onFinished;
    matchEngineStarts += 1;
  }, [onProgress, onFinished]);
  return <div data-testid="match-view">Match engine</div>;
}

vi.mock("../match/MatchView", () => ({
  MatchView: MatchViewLifecycleProbe,
}));
vi.mock("../game/audio/useShowAudioCue", () => ({ useShowAudioCue: vi.fn() }));
vi.mock("../ws/useWebSocketConnection", () => ({
  useWebSocketConnection: () => ({
    status: "connected",
    clientId: "exec",
    lastMessage: connection.lastMessage,
    subscribe: (listener: (message: OutboundMessage) => void) => {
      connection.listeners.add(listener);
      return () => {
        connection.listeners.delete(listener);
      };
    },
    send: connection.send,
  }),
}));

afterEach(() => {
  cleanup();
  connection.lastMessage = null;
  connection.listeners.clear();
  connection.send.mockClear();
  matchEngineStarts = 0;
});

const match: MatchDef = {
  id: "m1",
  participants: [
    { botId: "b1", name: "Alpha", author: "A", color: "#0ff" },
    { botId: "b2", name: "Beta", author: "B", color: "#f0f" },
  ],
  status: "running",
  result: null,
};
const tournament: TournamentState = {
  mode: "single-elimination",
  stageLevelIds: ["level-one"],
  livesPerRun: 3,
  groupSize: 2,
  rounds: [[match]],
  status: "running",
  championBotId: null,
};

function runningShow(executorClientId: string): TournamentShowState {
  return {
    phase: "match-running",
    activeMatchId: "m1",
    activeRoundIndex: 0,
    matchAttemptId: "attempt-1",
    executorClientId,
    phaseEndsAtMs: null,
    heldRemainingMs: null,
    holds: [],
    presentReady: true,
  };
}

describe("PresentStage", () => {
  it("keeps display-only clients from mounting Phaser", () => {
    const { container } = render(
      <PresentStage
        tournament={tournament}
        show={runningShow("exec")}
        clientId="display"
        bots={[]}
        progressByMatch={new Map()}
        clockOffsetMs={0}
        onProgress={vi.fn()}
        onFinished={vi.fn()}
      />
    );
    expect(screen.queryByTestId("match-view")).toBeNull();
    expect(screen.getByText(/Display-Modus/)).toBeTruthy();
    expect(container.querySelector(".present-live-stage")?.getAttribute("data-executor")).toBe(
      "false"
    );
  });

  it("mounts Phaser only for the current executor", () => {
    const { container } = render(
      <PresentStage
        tournament={tournament}
        show={runningShow("exec")}
        clientId="exec"
        bots={[]}
        progressByMatch={new Map()}
        clockOffsetMs={0}
        onProgress={vi.fn()}
        onFinished={vi.fn()}
      />
    );
    expect(screen.getByTestId("match-view")).toBeTruthy();
    expect(container.querySelector(".present-live-stage")?.getAttribute("data-executor")).toBe(
      "true"
    );
  });
});

describe("PresentPage", () => {
  it("does not restart the match engine when live progress arrives", async () => {
    render(<PresentPage />);
    act(() => {
      const message: OutboundMessage = {
        type: "tournament-state",
        state: tournament,
        show: runningShow("exec"),
        serverNowMs: Date.now(),
      };
      for (const listener of connection.listeners) listener(message);
    });
    await screen.findByTestId("match-view");

    act(() => {
      const message: OutboundMessage = {
        type: "match-progress",
        matchId: "m1",
        matchAttemptId: "attempt-1",
        entries: [],
      };
      for (const listener of connection.listeners) listener(message);
    });

    expect(matchEngineStarts).toBe(1);
  });
});
