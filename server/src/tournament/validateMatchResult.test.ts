import type { MatchDef, MatchResult, MatchResultEntry } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { validateMatchResult } from "./validateMatchResult";

const match: MatchDef = {
  id: "match-1",
  participants: [
    { botId: "bot-1", name: "One", author: "A", color: "#111" },
    { botId: "bot-2", name: "Two", author: "B", color: "#222" },
  ],
  status: "running",
  result: null,
};

function entry(botId: string, rank: number): MatchResultEntry {
  return {
    botId,
    rank,
    score: 100 - rank,
    fruitScore: 10,
    coinsCollected: 3,
    deaths: 0,
    timeElapsedMs: 1_000,
    reachedGoal: true,
    disabled: false,
  };
}

function result(entries: MatchResultEntry[]): MatchResult {
  return { entries };
}

describe("validateMatchResult", () => {
  it("accepts a complete result with a negative but finite score", () => {
    const second = { ...entry("bot-2", 2), score: -5 };

    expect(validateMatchResult(match, result([entry("bot-1", 1), second]))).toBe(true);
  });

  it.each([
    { name: "empty entries", value: result([]) },
    { name: "missing participant", value: result([entry("bot-1", 1)]) },
    {
      name: "foreign participant",
      value: result([entry("bot-1", 1), entry("bot-3", 2)]),
    },
    {
      name: "duplicate participant",
      value: result([entry("bot-1", 1), entry("bot-1", 2)]),
    },
    {
      name: "duplicate rank",
      value: result([entry("bot-1", 1), entry("bot-2", 1)]),
    },
    {
      name: "rank gap",
      value: result([entry("bot-1", 1), entry("bot-2", 3)]),
    },
    {
      name: "fractional rank",
      value: result([entry("bot-1", 1), entry("bot-2", 1.5)]),
    },
    {
      name: "rank starting at zero",
      value: result([entry("bot-1", 0), entry("bot-2", 1)]),
    },
  ])("rejects $name", ({ value }) => {
    expect(validateMatchResult(match, value)).toBe(false);
  });

  it.each([
    ["score", Number.NaN],
    ["score", Number.POSITIVE_INFINITY],
    ["fruitScore", -1],
    ["fruitScore", 1.5],
    ["coinsCollected", -1],
    ["deaths", -1],
    ["timeElapsedMs", -1],
    ["timeElapsedMs", Number.POSITIVE_INFINITY],
  ] as const)("rejects invalid %s value %s", (field, value) => {
    const invalid = { ...entry("bot-2", 2), [field]: value };

    expect(validateMatchResult(match, result([entry("bot-1", 1), invalid]))).toBe(false);
  });
});
