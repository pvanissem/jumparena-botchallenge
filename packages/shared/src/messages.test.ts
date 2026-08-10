import { describe, expect, it } from "vitest";
import type {
  MatchProgressMessage,
  MatchResult,
  MatchResultMessage,
  TournamentState,
} from "./index";
import {
  isMatchProgressMessage,
  isMatchResultMessage,
  isMatchStartMessage,
  isTournamentConfigureMessage,
  isTournamentResetMessage,
  isTournamentStateMessage,
} from "./messages";

function validResult(): MatchResult {
  return {
    entries: [
      {
        botId: "b1",
        rank: 1,
        score: 100,
        fruitScore: 50,
        coinsCollected: 5,
        deaths: 0,
        timeElapsedMs: 10_000,
        reachedGoal: true,
        disabled: false,
      },
    ],
  };
}

function validState(): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-one"],
    livesPerRun: 3,
    groupSize: 4,
    rounds: [
      [
        {
          id: "m1",
          participants: [{ botId: "b1", name: "Bot", author: "A", color: "#000" }],
          status: "pending",
          result: null,
        },
      ],
    ],
    status: "idle",
    championBotId: null,
  };
}

describe("isTournamentConfigureMessage", () => {
  it("accepts a valid configure message", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: ["b1", "b2"],
      })
    ).toBe(true);
  });

  it("accepts an explicit livesPerRun", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: ["b1", "b2"],
        livesPerRun: 5,
      })
    ).toBe(true);
  });

  it("rejects a non-numeric livesPerRun", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: ["b1", "b2"],
        livesPerRun: "5",
      })
    ).toBe(false);
  });

  it("accepts an explicit groupSize", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: ["b1", "b2"],
        groupSize: 2,
      })
    ).toBe(true);
  });

  it("rejects a non-numeric groupSize", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: ["b1", "b2"],
        groupSize: "2",
      })
    ).toBe(false);
  });

  it("rejects multiple stage level ids", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one", "level-two"],
        botIds: ["b1"],
      })
    ).toBe(true);
  });

  it("rejects non-string stageLevelIds entries", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: [1, 2],
        botIds: ["b1"],
      })
    ).toBe(false);
  });

  it("rejects missing stageLevelIds", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        botIds: ["b1"],
      })
    ).toBe(false);
  });

  it("rejects a non-single-elimination mode", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "round-robin" as never,
        stageLevelIds: ["level-one"],
        botIds: ["b1"],
      })
    ).toBe(false);
  });

  it("rejects non-string botIds entries", () => {
    expect(
      isTournamentConfigureMessage({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: [1],
      })
    ).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(isTournamentConfigureMessage({ type: "tournament-configure" })).toBe(false);
  });
});

describe("isMatchStartMessage", () => {
  it("accepts a valid message", () => {
    expect(isMatchStartMessage({ type: "match-start", matchId: "m1" })).toBe(true);
  });

  it("rejects missing matchId", () => {
    expect(isMatchStartMessage({ type: "match-start" })).toBe(false);
  });
});

describe("isTournamentResetMessage", () => {
  it("accepts a valid message", () => {
    expect(isTournamentResetMessage({ type: "tournament-reset" })).toBe(true);
  });

  it("rejects extra required fields", () => {
    expect(isTournamentResetMessage({ type: "tournament-reset", foo: "bar" })).toBe(true);
  });

  it("rejects wrong type", () => {
    expect(isTournamentResetMessage({ type: "match-start" })).toBe(false);
  });
});

describe("isMatchResultMessage", () => {
  it("accepts a valid message", () => {
    const message: MatchResultMessage = {
      type: "match-result",
      matchId: "m1",
      result: validResult(),
    };
    expect(isMatchResultMessage(message)).toBe(true);
  });

  it("rejects an invalid result entry", () => {
    expect(
      isMatchResultMessage({
        type: "match-result",
        matchId: "m1",
        result: { entries: [{ botId: "b1" }] },
      })
    ).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(isMatchResultMessage({ type: "match-start", matchId: "m1" })).toBe(false);
  });
});

describe("isMatchProgressMessage", () => {
  it("accepts a valid message", () => {
    const message: MatchProgressMessage = {
      type: "match-progress",
      matchId: "m1",
      entries: [
        {
          botId: "b1",
          fruitScore: 10,
          livesRemaining: 2,
          timeElapsedMs: 1000,
          progress: 0.25,
          finished: false,
          didNotFinish: false,
          disabled: false,
        },
      ],
    };
    expect(isMatchProgressMessage(message)).toBe(true);
  });

  it("rejects missing entry fields", () => {
    expect(
      isMatchProgressMessage({
        type: "match-progress",
        matchId: "m1",
        entries: [{ botId: "b1" }],
      })
    ).toBe(false);
  });

  it("rejects non-array entries", () => {
    expect(
      isMatchProgressMessage({
        type: "match-progress",
        matchId: "m1",
        entries: "nope",
      })
    ).toBe(false);
  });
});

describe("isTournamentStateMessage", () => {
  it("accepts a valid state", () => {
    expect(isTournamentStateMessage({ type: "tournament-state", state: validState() })).toBe(true);
  });

  it("accepts null state", () => {
    expect(isTournamentStateMessage({ type: "tournament-state", state: null })).toBe(true);
  });

  it("rejects invalid round shape", () => {
    const state = validState();
    state.rounds = [[{ id: "m1" } as never]];
    expect(isTournamentStateMessage({ type: "tournament-state", state })).toBe(false);
  });

  it("rejects unknown status", () => {
    const state = validState();
    state.status = "cancelled" as never;
    expect(isTournamentStateMessage({ type: "tournament-state", state })).toBe(false);
  });

  it("rejects a state without livesPerRun", () => {
    const state = validState() as Partial<TournamentState>;
    state.livesPerRun = undefined;
    expect(isTournamentStateMessage({ type: "tournament-state", state })).toBe(false);
  });

  it("rejects a state without groupSize", () => {
    const state = validState() as Partial<TournamentState>;
    state.groupSize = undefined;
    expect(isTournamentStateMessage({ type: "tournament-state", state })).toBe(false);
  });

  it("rejects a state without stageLevelIds", () => {
    const state = validState() as Partial<TournamentState>;
    state.stageLevelIds = undefined;
    expect(isTournamentStateMessage({ type: "tournament-state", state })).toBe(false);
  });

  it("rejects a state with non-string stageLevelIds entries", () => {
    const state = validState() as Partial<TournamentState>;
    state.stageLevelIds = [1, 2] as never;
    expect(isTournamentStateMessage({ type: "tournament-state", state })).toBe(false);
  });
});
