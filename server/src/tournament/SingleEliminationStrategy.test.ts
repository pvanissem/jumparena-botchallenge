import { randomUUID } from "node:crypto";
import type { MatchParticipant, MatchResult, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import {
  createMatchId,
  MAX_GROUP_SIZE,
  SingleEliminationStrategy,
} from "./SingleEliminationStrategy";

function participant(id: string): MatchParticipant {
  return { botId: id, name: `Bot ${id}`, author: "A", color: "#000" };
}

function participants(count: number): MatchParticipant[] {
  return Array.from({ length: count }, (_, i) => participant(`b${i + 1}`));
}

function noShuffle<T>(array: readonly T[]): T[] {
  return [...array];
}

function reverseShuffle<T>(array: readonly T[]): T[] {
  return [...array].reverse();
}

describe("createRounds", () => {
  it("creates one finished bye match for a single participant", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds([participant("b1")], "level-one");

    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toHaveLength(1);
    expect(rounds[0][0].status).toBe("finished");
    expect(rounds[0][0].result?.entries).toEqual([
      expect.objectContaining({ botId: "b1", rank: 1 }),
    ]);
  });

  it("never creates groups larger than 4", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(5), "level-one");

    expect(rounds[0].every((m) => m.participants.length <= MAX_GROUP_SIZE)).toBe(true);
  });

  it("distributes remainders into smaller last groups", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(5), "level-one");

    expect(rounds[0]).toHaveLength(2);
    expect(rounds[0][0].participants).toHaveLength(4);
    expect(rounds[0][1].participants).toHaveLength(1);
  });

  it.each([
    { count: 1, expectedGroups: [1] },
    { count: 2, expectedGroups: [2] },
    { count: 3, expectedGroups: [3] },
    { count: 4, expectedGroups: [4] },
    { count: 5, expectedGroups: [4, 1] },
    { count: 9, expectedGroups: [4, 4, 1] },
    { count: 16, expectedGroups: [4, 4, 4, 4] },
  ])("for $count participants creates groups $expectedGroups", ({ count, expectedGroups }) => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(count), "level-one");

    const groupSizes = rounds[0].map((m) => m.participants.length);
    expect(groupSizes).toEqual(expectedGroups);
  });

  it("uses the injected shuffle function", () => {
    const strategy = new SingleEliminationStrategy(reverseShuffle);
    const rounds = strategy.createRounds(participants(4), "level-one");

    expect(rounds[0][0].participants.map((p) => p.botId)).toEqual(["b4", "b3", "b2", "b1"]);
  });

  it("creates deterministic match ids based on randomUUID", () => {
    const strategy1 = new SingleEliminationStrategy(noShuffle, randomUUID);
    const strategy2 = new SingleEliminationStrategy(noShuffle, randomUUID);
    const rounds1 = strategy1.createRounds(participants(2), "level-one");
    const rounds2 = strategy2.createRounds(participants(2), "level-one");

    expect(rounds1[0][0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(rounds1[0][0].id).not.toBe(rounds2[0][0].id);
  });
});

describe("advance", () => {
  function freshState(initialParticipants: MatchParticipant[]): TournamentState {
    const strategy = new SingleEliminationStrategy(noShuffle, createMatchId);
    return {
      mode: "single-elimination",
      levelId: "level-one",
      livesPerRun: 3,
      rounds: strategy.createRounds(initialParticipants, "level-one"),
      status: "idle",
      championBotId: null,
    };
  }

  function result(ranks: { botId: string; rank: number }[]): MatchResult {
    return {
      entries: ranks.map((r) => ({
        botId: r.botId,
        rank: r.rank,
        score: 100 - r.rank * 10,
        fruitScore: 50,
        coinsCollected: 5,
        deaths: 0,
        timeElapsedMs: 1000,
        reachedGoal: true,
        disabled: false,
      })),
    };
  }

  it("sets the result on the running match", () => {
    const state = freshState(participants(2));
    state.rounds[0][0].status = "running";
    const res = result([{ botId: "b1", rank: 1 }]);

    const next = new SingleEliminationStrategy(noShuffle).advance(state, res);

    expect(next.rounds[0][0].status).toBe("finished");
    expect(next.rounds[0][0].result).toEqual(res);
  });

  it("creates next round only after all current matches are finished", () => {
    const state = freshState(participants(5));
    const m1 = state.rounds[0][0];
    const m2 = state.rounds[0][1];

    m1.status = "running";

    const afterFirst = new SingleEliminationStrategy(noShuffle).advance(
      state,
      result([{ botId: m1.participants[0].botId, rank: 1 }])
    );

    expect(afterFirst.rounds).toHaveLength(2);
    expect(afterFirst.rounds[1][0].participants.map((p) => p.botId)).toEqual([
      m1.participants[0].botId,
      m2.participants[0].botId,
    ]);
  });

  it("promotes only the first-ranked bot", () => {
    const state = freshState(participants(5));
    state.rounds[0][0].status = "running";

    const next = new SingleEliminationStrategy(noShuffle).advance(
      state,
      result([
        { botId: "b1", rank: 1 },
        { botId: "b2", rank: 2 },
        { botId: "b3", rank: 3 },
        { botId: "b4", rank: 4 },
      ])
    );

    expect(next.rounds).toHaveLength(2);
    expect(next.rounds[1][0].participants.map((p) => p.botId)).toEqual(["b1", "b5"]);
  });

  it("marks tournament finished and sets champion when one bot remains", () => {
    const state = freshState(participants(2));
    state.rounds[0][0].status = "running";
    state.status = "running";

    const next = new SingleEliminationStrategy(noShuffle).advance(
      state,
      result([{ botId: "b1", rank: 1 }])
    );

    expect(next.status).toBe("finished");
    expect(next.championBotId).toBe("b1");
    expect(next.rounds).toHaveLength(1);
  });
});

describe("createMatchId", () => {
  it("generates unique UUIDs", () => {
    const id1 = createMatchId();
    const id2 = createMatchId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
