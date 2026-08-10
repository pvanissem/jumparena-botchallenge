import type { MatchDef, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { selectMatchStage } from "./selectMatchStage";

function match(overrides: Partial<MatchDef> & { id: string }): MatchDef {
  return {
    participants: [
      { botId: "b1", name: "Bot 1", author: "A", color: "#000" },
      { botId: "b2", name: "Bot 2", author: "B", color: "#111" },
    ],
    status: "pending",
    result: null,
    ...overrides,
  };
}

function finishedResult(botId: string) {
  return {
    entries: [
      {
        botId,
        rank: 1,
        score: 10,
        fruitScore: 5,
        coinsCollected: 1,
        deaths: 0,
        timeElapsedMs: 100,
        reachedGoal: true,
        disabled: false,
      },
    ],
  };
}

function state(rounds: MatchDef[][], overrides: Partial<TournamentState> = {}): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-one"],
    livesPerRun: 3,
    groupSize: 4,
    rounds,
    status: "running",
    championBotId: null,
    ...overrides,
  };
}

describe("selectMatchStage", () => {
  it("returns 'no-tournament' when there is no state", () => {
    expect(selectMatchStage(null)).toEqual({ kind: "no-tournament" });
  });

  it("returns 'champion' when the tournament is finished", () => {
    const s = state([[match({ id: "m1", status: "finished", result: finishedResult("b1") })]], {
      status: "finished",
      championBotId: "b1",
    });

    expect(selectMatchStage(s)).toEqual({ kind: "champion" });
  });

  it("returns 'running' for the match currently being played", () => {
    const running = match({ id: "m2", status: "running" });
    const s = state([
      [match({ id: "m1", status: "finished", result: finishedResult("b1") }), running],
    ]);

    expect(selectMatchStage(s)).toEqual({ kind: "running", match: running, roundIndex: 0 });
  });

  it("prefers a running match in a later round over an earlier finished match", () => {
    const finished = match({ id: "m1", status: "finished", result: finishedResult("b1") });
    const running = match({ id: "m2", status: "running" });
    const s = state([[finished], [running]]);

    expect(selectMatchStage(s)).toEqual({ kind: "running", match: running, roundIndex: 1 });
  });

  it("returns the LAST finished match result when nothing is running", () => {
    const first = match({ id: "m1", status: "finished", result: finishedResult("b1") });
    const second = match({ id: "m2", status: "finished", result: finishedResult("b2") });
    const s = state([[first, second], [match({ id: "m3" })]]);

    expect(selectMatchStage(s)).toEqual({ kind: "result", match: second, roundIndex: 0 });
  });

  it("ignores bye matches (single participant) when showing a result", () => {
    const bye = match({
      id: "bye",
      status: "finished",
      result: finishedResult("b9"),
      participants: [{ botId: "b9", name: "Bot 9", author: "C", color: "#222" }],
    });
    const s = state([[bye, match({ id: "m1" })]]);

    expect(selectMatchStage(s)).toEqual({ kind: "bracket" });
  });

  it("returns 'bracket' when nothing has been played yet", () => {
    const s = state([[match({ id: "m1" }), match({ id: "m2" })]], { status: "idle" });

    expect(selectMatchStage(s)).toEqual({ kind: "bracket" });
  });

  it("liefert für ein laufendes Match den korrekten roundIndex", () => {
    const running = match({ id: "m2", status: "running" });
    const s = state([[match({ id: "m1" })], [running]]);

    expect(selectMatchStage(s)).toEqual({ kind: "running", match: running, roundIndex: 1 });
  });

  it("liefert für ein Ergebnis den roundIndex der neuesten beendeten Runde", () => {
    const finished = match({ id: "m1", status: "finished", result: finishedResult("b1") });
    const s = state([[match({ id: "p1" })], [finished, match({ id: "p2" })]]);

    expect(selectMatchStage(s)).toEqual({ kind: "result", match: finished, roundIndex: 1 });
  });
});
