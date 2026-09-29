import { randomUUID } from "node:crypto";
import type { MatchParticipant, MatchResult, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { createMatchId, SingleEliminationStrategy } from "./SingleEliminationStrategy";

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

const DEFAULT_GROUP_SIZE = 4;

describe("createRounds", () => {
  it("creates one finished bye match for a single participant", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds([participant("b1")], {
      groupSize: DEFAULT_GROUP_SIZE,
    });

    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toHaveLength(1);
    expect(rounds[0][0].status).toBe("finished");
    expect(rounds[0][0].result?.entries).toEqual([
      expect.objectContaining({ botId: "b1", rank: 1 }),
    ]);
  });

  it("never creates groups larger than 4", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(5), {
      groupSize: DEFAULT_GROUP_SIZE,
    });

    expect(rounds[0].every((m) => m.participants.length <= DEFAULT_GROUP_SIZE)).toBe(true);
  });

  it("distributes remainders into smaller last groups", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(5), {
      groupSize: DEFAULT_GROUP_SIZE,
    });

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
    const rounds = strategy.createRounds(participants(count), {
      groupSize: DEFAULT_GROUP_SIZE,
    });

    const groupSizes = rounds[0].map((m) => m.participants.length);
    expect(groupSizes).toEqual(expectedGroups);
  });

  it("uses the injected shuffle function", () => {
    const strategy = new SingleEliminationStrategy(reverseShuffle);
    const rounds = strategy.createRounds(participants(4), {
      groupSize: DEFAULT_GROUP_SIZE,
    });

    expect(rounds[0][0].participants.map((p) => p.botId)).toEqual(["b4", "b3", "b2", "b1"]);
  });

  it("creates deterministic match ids based on randomUUID", () => {
    const strategy1 = new SingleEliminationStrategy(noShuffle, randomUUID);
    const strategy2 = new SingleEliminationStrategy(noShuffle, randomUUID);
    const rounds1 = strategy1.createRounds(participants(2), {
      groupSize: DEFAULT_GROUP_SIZE,
    });
    const rounds2 = strategy2.createRounds(participants(2), {
      groupSize: DEFAULT_GROUP_SIZE,
    });

    expect(rounds1[0][0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(rounds1[0][0].id).not.toBe(rounds2[0][0].id);
  });

  it("supports a groupSize of 2", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(4), {
      groupSize: 2,
    });

    expect(rounds[0]).toHaveLength(2);
    expect(rounds[0][0].participants).toHaveLength(2);
    expect(rounds[0][1].participants).toHaveLength(2);
  });

  it("supports a groupSize of 4 as a regression guard", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(8), {
      groupSize: 4,
    });

    expect(rounds[0]).toHaveLength(2);
    expect(rounds[0][0].participants).toHaveLength(4);
    expect(rounds[0][1].participants).toHaveLength(4);
  });

  it("keeps the unpaired first-round bot pending for a best-loser duel in groupSize 2", () => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    const rounds = strategy.createRounds(participants(3), {
      groupSize: 2,
    });

    expect(rounds[0]).toHaveLength(2);
    expect(rounds[0][0].participants).toHaveLength(2);
    expect(rounds[0][0].status).toBe("pending");
    expect(rounds[0][1].participants).toHaveLength(1);
    expect(rounds[0][1].status).toBe("pending");
    expect(rounds[0][1].result).toBeNull();
  });
});

describe("advance", () => {
  function freshState(
    initialParticipants: MatchParticipant[],
    groupSize: number = DEFAULT_GROUP_SIZE
  ): TournamentState {
    const strategy = new SingleEliminationStrategy(noShuffle, createMatchId);
    return {
      mode: "single-elimination",
      stageLevelIds: ["level-one"],
      livesPerRun: 3,
      groupSize,
      rounds: strategy.createRounds(initialParticipants, {
        groupSize,
      }),
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

  it.each([3, 5, 7])("requires a best-loser duel before advancing %s entrants", (count) => {
    const strategy = new SingleEliminationStrategy(noShuffle);
    let state = freshState(participants(count), 2);
    const regularMatchCount = Math.floor(count / 2);
    for (let index = 0; index < regularMatchCount; index++) {
      const match = state.rounds[0][index];
      match.status = "running";
      const before = structuredClone(state);
      state = strategy.advance(
        state,
        match.id,
        result(
          match.participants.map((p, rank) => ({
            botId: p.botId,
            rank: rank + 1,
          }))
        )
      );
      expect(before.rounds[0][regularMatchCount].participants).toHaveLength(1);
      expect(state.rounds).toHaveLength(1);
      expect(state.rounds[0][regularMatchCount].status).toBe("pending");
      if (index < regularMatchCount - 1) {
        expect(state.rounds[0][regularMatchCount].participants).toHaveLength(1);
      }
    }
    const duel = state.rounds[0][regularMatchCount];
    expect(duel.participants.map((p) => p.botId)).toEqual([`b${count}`, "b2"]);
    duel.status = "running";
    state = strategy.advance(
      state,
      duel.id,
      result([
        { botId: "b2", rank: 1 },
        { botId: `b${count}`, rank: 2 },
      ])
    );
    expect(state.rounds).toHaveLength(2);
    expect(state.rounds[1].flatMap((match) => match.participants.map((p) => p.botId))).toEqual([
      ...Array.from({ length: regularMatchCount }, (_, i) => `b${i * 2 + 1}`),
      "b2",
    ]);
    if (count === 5) {
      expect(state.rounds[1][1]).toMatchObject({ status: "finished" });
    }

    while (state.status !== "finished") {
      const next = state.rounds.flat().find((match) => match.status === "pending");
      expect(next).toBeDefined();
      if (!next) break;
      next.status = "running";
      state = strategy.advance(
        state,
        next.id,
        result(
          next.participants.map((p, index) => ({
            botId: p.botId,
            rank: index + 1,
          }))
        )
      );
    }
    expect(state.championBotId).toBe("b1");
  });

  it.each([
    { scores: [10, 30, 20], times: [1000, 2000, 1000], expected: "b4" },
    { scores: [30, 30, 20], times: [2000, 1000, 500], expected: "b4" },
    { scores: [30, 30, 30], times: [1000, 1000, 1000], expected: "b2" },
  ])(
    "selects the best loser by score, time, then bracket order: $expected",
    ({ scores, times, expected }) => {
      const strategy = new SingleEliminationStrategy(noShuffle);
      let state = freshState(participants(7), 2);
      // Finish out of order to distinguish bracket order from arrival order.
      for (const index of [2, 1, 0]) {
        const match = state.rounds[0][index];
        match.status = "running";
        const matchResult = result(
          match.participants.map((p, rank) => ({
            botId: p.botId,
            rank: rank + 1,
          }))
        );
        matchResult.entries[1].score = scores[index];
        matchResult.entries[1].timeElapsedMs = times[index];
        const previous = state;
        const before = structuredClone(previous);
        state = strategy.advance(state, match.id, matchResult);
        expect(previous).toEqual(before);
      }
      expect(state.rounds[0][3].participants.map((p) => p.botId)).toEqual(["b7", expected]);
      expect(state.rounds).toHaveLength(1);
    }
  );

  it("sets the result on the running match", () => {
    const state = freshState(participants(2));
    state.rounds[0][0].status = "running";
    const res = result([{ botId: "b1", rank: 1 }]);

    const next = new SingleEliminationStrategy(noShuffle).advance(
      state,
      state.rounds[0][0].id,
      res
    );

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
      m1.id,
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
      state.rounds[0][0].id,
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
      state.rounds[0][0].id,
      result([{ botId: "b1", rank: 1 }])
    );

    expect(next.status).toBe("finished");
    expect(next.championBotId).toBe("b1");
    expect(next.rounds).toHaveLength(1);
  });

  it("uses the state's groupSize for follow-up rounds", () => {
    // 4 participants, groupSize 2 -> two semi-finals, then a final for 2.
    const state = freshState(participants(4), 2);
    state.rounds[0][0].status = "running";
    state.rounds[0][1].status = "running";
    state.status = "running";

    const afterSemi1 = new SingleEliminationStrategy(noShuffle).advance(
      state,
      state.rounds[0][0].id,
      result([
        { botId: "b1", rank: 1 },
        { botId: "b2", rank: 2 },
      ])
    );

    expect(afterSemi1.rounds).toHaveLength(1);

    const afterSemi2 = new SingleEliminationStrategy(noShuffle).advance(
      afterSemi1,
      afterSemi1.rounds[0][1].id,
      result([
        { botId: "b3", rank: 1 },
        { botId: "b4", rank: 2 },
      ])
    );

    expect(afterSemi2.rounds).toHaveLength(2);
    expect(afterSemi2.rounds[1]).toHaveLength(1);
    expect(afterSemi2.rounds[1][0].participants.map((p) => p.botId)).toEqual(["b1", "b3"]);
    expect(afterSemi2.rounds[1][0].participants).toHaveLength(2);
  });

  it("changes only the explicitly selected match when multiple matches are running", () => {
    const state = freshState(participants(4), 2);
    const firstMatch = state.rounds[0][0];
    const secondMatch = state.rounds[0][1];
    firstMatch.status = "running";
    secondMatch.status = "running";

    const next = new SingleEliminationStrategy(noShuffle).advance(
      state,
      secondMatch.id,
      result([
        { botId: "b3", rank: 1 },
        { botId: "b4", rank: 2 },
      ])
    );

    expect(next.rounds[0][0]).toMatchObject({ status: "running", result: null });
    expect(next.rounds[0][1]).toMatchObject({ status: "finished" });
    expect(next.rounds[0][1].result?.entries[0].botId).toBe("b3");
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
