import { describe, expect, it } from "vitest";
import type { LevelDef } from "../game/level/types";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { computeMatchProgress } from "./matchProgress";

function level(spawnX = 0, goalX = 1000): LevelDef {
  return {
    worldWidth: goalX + 200,
    worldHeight: 600,
    groundY: 500,
    spawn: { x: spawnX, y: 0 },
    goal: { x: goalX, y: 0 },
    platforms: [],
    coins: [],
    hiddenCoinBlocks: [],
    checkpoints: [],
    hazards: [],
    utilities: [],
  };
}

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
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

describe("computeMatchProgress", () => {
  it("is 0 at spawn", () => {
    const lvl = level(0, 1000);
    expect(computeMatchProgress(lvl, racer())).toBe(0);
  });

  it("is 1 when finished", () => {
    const lvl = level(0, 1000);
    expect(computeMatchProgress(lvl, racer({ x: 123, finished: true }))).toBe(1);
  });

  it("scales linearly between spawn and goal", () => {
    const lvl = level(0, 1000);
    expect(computeMatchProgress(lvl, racer({ x: 500 }))).toBe(0.5);
  });

  it("clamps progress to [0, 1]", () => {
    const lvl = level(100, 500);
    expect(computeMatchProgress(lvl, racer({ x: 0 }))).toBe(0);
    expect(computeMatchProgress(lvl, racer({ x: 1000, didNotFinish: true }))).toBe(1);
  });
});
