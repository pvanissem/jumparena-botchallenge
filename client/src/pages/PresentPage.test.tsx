import type { MatchDef, TournamentShowState, TournamentState } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentStage } from "./PresentPage";

vi.mock("../match/MatchView", () => ({
  MatchView: () => <div data-testid="match-view">Match engine</div>,
}));
vi.mock("../game/audio/useShowAudioCue", () => ({ useShowAudioCue: vi.fn() }));

afterEach(cleanup);

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
    render(
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
  });

  it("mounts Phaser only for the current executor", () => {
    render(
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
  });
});
