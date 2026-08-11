import { describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { rankMatchResults } from "./rankMatchResults";

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: false,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 0,
    livesRemaining: 3,
    deaths: 0,
    timeElapsedMs: 0,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

describe("rankMatchResults", () => {
  it("ranks by score descending", () => {
    const entries = rankMatchResults([
      {
        botId: "b1",
        state: racer({ fruitScore: 100, finished: true, timeElapsedMs: 10_000 }),
        disabled: false,
      },
      {
        botId: "b2",
        state: racer({ fruitScore: 200, finished: true, timeElapsedMs: 10_000 }),
        disabled: false,
      },
    ]);

    expect(entries.map((e) => e.botId)).toEqual(["b2", "b1"]);
    expect(entries[0].rank).toBe(1);
    expect(entries[1].rank).toBe(2);
  });

  it("uses shorter time as tie-breaker", () => {
    const entries = rankMatchResults([
      {
        botId: "b1",
        state: racer({ fruitScore: 100, finished: true, timeElapsedMs: 20_000 }),
        disabled: false,
      },
      {
        botId: "b2",
        state: racer({ fruitScore: 100, finished: true, timeElapsedMs: 15_000 }),
        disabled: false,
      },
    ]);

    expect(entries.map((e) => e.botId)).toEqual(["b2", "b1"]);
  });

  it("normalizes fractional Phaser time to protocol-safe milliseconds", () => {
    const [entry] = rankMatchResults([
      {
        botId: "b1",
        state: racer({ finished: true, timeElapsedMs: 4_123.75 }),
        disabled: false,
      },
    ]);

    expect(entry.timeElapsedMs).toBe(4_124);
  });

  it("assigns consecutive ranks starting at 1", () => {
    const entries = rankMatchResults([
      { botId: "b1", state: racer({ fruitScore: 300, finished: true }), disabled: false },
      { botId: "b2", state: racer({ fruitScore: 200, finished: true }), disabled: false },
      { botId: "b3", state: racer({ fruitScore: 100, finished: true }), disabled: false },
    ]);

    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("includes disabled racers", () => {
    const entries = rankMatchResults([
      { botId: "b1", state: racer({ fruitScore: 100, finished: true }), disabled: false },
      { botId: "b2", state: racer({ fruitScore: 0, didNotFinish: true }), disabled: true },
    ]);

    expect(entries.map((e) => e.botId)).toEqual(["b1", "b2"]);
    expect(entries[1].disabled).toBe(true);
  });

  it("reports DNF correctly", () => {
    const entries = rankMatchResults([
      {
        botId: "b1",
        state: racer({ fruitScore: 50, didNotFinish: true, deaths: 2, timeElapsedMs: 90_000 }),
        disabled: false,
      },
    ]);

    expect(entries[0].reachedGoal).toBe(false);
    expect(entries[0].score).toBeLessThan(entries[0].fruitScore);
  });
});
