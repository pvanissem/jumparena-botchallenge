import type { MatchResult, MatchResultMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { TournamentService } from "../TournamentService";
import { createMatchResultHandler } from "./createMatchResultHandler";

function makeService(submitResult: boolean): TournamentService {
  return {
    submitResult: vi.fn(() => submitResult),
  } as unknown as TournamentService;
}

function result(): MatchResult {
  return {
    entries: [
      {
        botId: "b1",
        rank: 1,
        score: 100,
        fruitScore: 50,
        coinsCollected: 5,
        deaths: 0,
        timeElapsedMs: 1000,
        reachedGoal: true,
        disabled: false,
      },
    ],
  };
}

describe("createMatchResultHandler", () => {
  const message: MatchResultMessage = { type: "match-result", matchId: "m1", result: result() };

  it("calls submitResult and broadcasts on success", () => {
    const service = makeService(true);
    const broadcast = vi.fn();

    createMatchResultHandler(service, broadcast)("sender", message);

    expect(service.submitResult).toHaveBeenCalledWith("m1", result());
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("does not broadcast when submitResult returns false", () => {
    const service = makeService(false);
    const broadcast = vi.fn();

    createMatchResultHandler(service, broadcast)("sender", message);

    expect(service.submitResult).toHaveBeenCalledWith("m1", result());
    expect(broadcast).not.toHaveBeenCalled();
  });
});
