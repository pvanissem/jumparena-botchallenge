import { describe, expect, it } from "vitest";
import type {
  MatchProgressMessage,
  MatchResult,
  MatchResultMessage,
  TournamentState,
} from "./index";
import {
  isClientRegisteredMessage,
  isClientRegisterMessage,
  isMatchProgressMessage,
  isMatchResultMessage,
  isPresentReadyMessage,
  isTournamentConfigureMessage,
  isTournamentResetMessage,
  isTournamentShowControlMessage,
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
      matchAttemptId: "attempt-1",
      result: validResult(),
    };
    expect(isMatchResultMessage(message)).toBe(true);
  });

  it("rejects an invalid result entry", () => {
    expect(
      isMatchResultMessage({
        type: "match-result",
        matchId: "m1",
        matchAttemptId: "attempt-1",
        result: { entries: [{ botId: "b1" }] },
      })
    ).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(isMatchResultMessage({ type: "match-start", matchId: "m1" })).toBe(false);
  });

  it("accepts a non-empty match attempt id", () => {
    expect(
      isMatchResultMessage({
        type: "match-result",
        matchId: "m1",
        matchAttemptId: "attempt-1",
        result: validResult(),
      })
    ).toBe(true);
  });

  it("rejects a missing match attempt id", () => {
    expect(
      isMatchResultMessage({ type: "match-result", matchId: "m1", result: validResult() })
    ).toBe(false);
  });

  it("rejects an empty match attempt id when present", () => {
    expect(
      isMatchResultMessage({
        type: "match-result",
        matchId: "m1",
        matchAttemptId: "",
        result: validResult(),
      })
    ).toBe(false);
  });
});

describe("isMatchProgressMessage", () => {
  it("accepts a valid message", () => {
    const message: MatchProgressMessage = {
      type: "match-progress",
      matchId: "m1",
      matchAttemptId: "attempt-1",
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
        matchAttemptId: "attempt-1",
        entries: [{ botId: "b1" }],
      })
    ).toBe(false);
  });

  it("rejects non-array entries", () => {
    expect(
      isMatchProgressMessage({
        type: "match-progress",
        matchId: "m1",
        matchAttemptId: "attempt-1",
        entries: "nope",
      })
    ).toBe(false);
  });

  it("accepts a non-empty match attempt id", () => {
    const message = {
      type: "match-progress",
      matchId: "m1",
      matchAttemptId: "attempt-1",
      entries: [],
    };
    expect(isMatchProgressMessage(message)).toBe(true);
  });

  it("rejects an empty match attempt id when present", () => {
    const message = {
      type: "match-progress",
      matchId: "m1",
      matchAttemptId: "",
      entries: [],
    };
    expect(isMatchProgressMessage(message)).toBe(false);
  });

  it("rejects a missing match attempt id", () => {
    expect(isMatchProgressMessage({ type: "match-progress", matchId: "m1", entries: [] })).toBe(
      false
    );
  });
});

describe("client role messages", () => {
  it.each(["admin", "present"])("accepts the %s client role", (role) => {
    expect(isClientRegisterMessage({ type: "client-register", role })).toBe(true);
    expect(
      isClientRegisteredMessage({ type: "client-registered", clientId: "client-1", role })
    ).toBe(true);
  });

  it("rejects unknown client roles and empty registration ids", () => {
    expect(isClientRegisterMessage({ type: "client-register", role: "dev" })).toBe(false);
    expect(
      isClientRegisteredMessage({ type: "client-registered", clientId: "", role: "present" })
    ).toBe(false);
  });
});

describe("isPresentReadyMessage", () => {
  it("accepts explicit readiness", () => {
    expect(isPresentReadyMessage({ type: "present-ready", ready: true })).toBe(true);
    expect(isPresentReadyMessage({ type: "present-ready", ready: false })).toBe(true);
  });

  it("rejects non-boolean readiness", () => {
    expect(isPresentReadyMessage({ type: "present-ready", ready: "yes" })).toBe(false);
  });
});

describe("isTournamentShowControlMessage", () => {
  it.each(["start", "pause", "resume", "advance"])("accepts the %s action", (action) => {
    expect(isTournamentShowControlMessage({ type: "tournament-show-control", action })).toBe(true);
  });

  it("rejects unknown actions", () => {
    expect(
      isTournamentShowControlMessage({ type: "tournament-show-control", action: "skip-match" })
    ).toBe(false);
  });
});

describe("isTournamentStateMessage", () => {
  it("accepts a valid state", () => {
    expect(
      isTournamentStateMessage({
        type: "tournament-state",
        state: validState(),
        show: null,
        serverNowMs: 1_000,
      })
    ).toBe(true);
  });

  it("accepts null state", () => {
    expect(
      isTournamentStateMessage({
        type: "tournament-state",
        state: null,
        show: null,
        serverNowMs: 1_000,
      })
    ).toBe(true);
  });

  it("rejects a snapshot without show or server time", () => {
    expect(isTournamentStateMessage({ type: "tournament-state", state: null })).toBe(false);
  });

  it("accepts a valid show snapshot", () => {
    expect(
      isTournamentStateMessage({
        type: "tournament-state",
        state: validState(),
        serverNowMs: 1_000,
        show: {
          phase: "matchup-intro",
          activeMatchId: "m1",
          activeRoundIndex: 0,
          matchAttemptId: null,
          executorClientId: null,
          phaseEndsAtMs: 6_000,
          heldRemainingMs: null,
          holds: [],
          presentReady: true,
        },
      })
    ).toBe(true);
  });

  it("rejects non-finite server time when present", () => {
    expect(
      isTournamentStateMessage({
        type: "tournament-state",
        state: validState(),
        serverNowMs: Number.POSITIVE_INFINITY,
      })
    ).toBe(false);
  });

  it("rejects unknown show phases and hold reasons", () => {
    const show = {
      phase: "intermission",
      activeMatchId: null,
      activeRoundIndex: null,
      matchAttemptId: null,
      executorClientId: null,
      phaseEndsAtMs: null,
      heldRemainingMs: null,
      holds: ["network"],
      presentReady: false,
    };
    expect(isTournamentStateMessage({ type: "tournament-state", state: validState(), show })).toBe(
      false
    );
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
