import type { MatchDef, TournamentShowState, TournamentState } from "@arena/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTournamentView } from "./AdminPage";

afterEach(cleanup);

const match: MatchDef = {
  id: "m1",
  participants: [
    { botId: "b1", name: "Alpha", author: "Ada", color: "#0ff" },
    { botId: "b2", name: "Beta", author: "Bob", color: "#f0f" },
  ],
  status: "pending",
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
const readyShow: TournamentShowState = {
  phase: "ready",
  activeMatchId: null,
  activeRoundIndex: null,
  matchAttemptId: null,
  executorClientId: null,
  phaseEndsAtMs: null,
  heldRemainingMs: null,
  holds: [],
  presentReady: true,
};

describe("AdminTournamentView", () => {
  it("controls the show and renders the full bracket without match start buttons", () => {
    const send = vi.fn();
    render(
      <AdminTournamentView
        tournament={tournament}
        show={readyShow}
        progressByMatch={new Map()}
        clockOffsetMs={0}
        send={send}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show starten" }));
    expect(send).toHaveBeenCalledWith({ type: "tournament-show-control", action: "start" });
    expect(screen.getByLabelText("Match m1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Match starten/ })).toBeNull();
  });

  it("shows live standings for the active match", () => {
    const runningShow = {
      ...readyShow,
      phase: "match-running",
      activeMatchId: "m1",
      activeRoundIndex: 0,
      matchAttemptId: "attempt-1",
      executorClientId: "present-1",
    } satisfies TournamentShowState;
    render(
      <AdminTournamentView
        tournament={{ ...tournament, rounds: [[{ ...match, status: "running" }]] }}
        show={runningShow}
        progressByMatch={new Map()}
        clockOffsetMs={0}
        send={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Live Score" })).toBeTruthy();
  });
});
