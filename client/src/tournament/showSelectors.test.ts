import type { MatchDef, TournamentShowState, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import {
  countCompletedMatches,
  countRemainingBots,
  selectActiveMatch,
  selectVisibleRoundRange,
} from "./showSelectors";

function match(id: string, status: MatchDef["status"], winnerId?: string): MatchDef {
  const participants = ["a", "b"].map((suffix) => ({
    botId: `${id}-${suffix}`,
    name: suffix,
    author: "A",
    color: "#000",
  }));
  return {
    id,
    participants,
    status,
    result: winnerId
      ? {
          entries: participants.map((participant) => ({
            botId: participant.botId,
            rank: participant.botId === winnerId ? 1 : 2,
            score: 0,
            fruitScore: 0,
            coinsCollected: 0,
            deaths: 0,
            timeElapsedMs: 0,
            reachedGoal: false,
            disabled: false,
          })),
        }
      : null,
  };
}

function state(rounds: MatchDef[][]): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-one"],
    livesPerRun: 3,
    groupSize: 2,
    rounds,
    status: "running",
    championBotId: null,
  };
}

describe("show selectors", () => {
  it("selects at most three rounds around the active round", () => {
    expect(selectVisibleRoundRange(6, 0)).toEqual({ startIndex: 0, endIndex: 2 });
    expect(selectVisibleRoundRange(6, 3)).toEqual({ startIndex: 2, endIndex: 4 });
    expect(selectVisibleRoundRange(6, 5)).toEqual({ startIndex: 3, endIndex: 5 });
  });

  it("counts finished matches and eliminated bots", () => {
    const finished = match("m1", "finished", "m1-a");
    const pending = match("m2", "pending");
    const tournament = state([[finished, pending]]);

    expect(countCompletedMatches(tournament)).toBe(1);
    expect(countRemainingBots(tournament)).toBe(3);
  });

  it("finds the active match from the show snapshot", () => {
    const active = match("m2", "running");
    const tournament = state([[match("m1", "finished", "m1-a"), active]]);
    const show = { activeMatchId: "m2" } as TournamentShowState;

    expect(selectActiveMatch(tournament, show)).toEqual({ match: active, roundIndex: 0 });
    expect(selectActiveMatch(tournament, null)).toBeNull();
  });
});
