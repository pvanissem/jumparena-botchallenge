import { describe, expect, it } from "vitest";
import type { LevelDef } from "../level/types";
import { LIVES_PER_RUN } from "./raceRules";
import { createInitialRacerState } from "./racerState";

const LEVEL: LevelDef = {
  worldWidth: 100,
  worldHeight: 100,
  groundY: 80,
  spawn: { x: 42, y: 58 },
  goal: { x: 90, y: 58 },
  platforms: [],
  coins: [],
  hiddenCoinBlocks: [],
  checkpoints: [],
  hazards: [],
  utilities: [],
};

describe("createInitialRacerState", () => {
  it("starts at the spawn position with lastCheckpoint = spawn", () => {
    const state = createInitialRacerState(LEVEL);
    expect(state.x).toBe(LEVEL.spawn.x);
    expect(state.y).toBe(LEVEL.spawn.y);
    expect(state.lastCheckpoint).toEqual(LEVEL.spawn);
  });

  it("starts with full lives, alive, not finished", () => {
    const state = createInitialRacerState(LEVEL);
    expect(state.livesRemaining).toBe(LIVES_PER_RUN);
    expect(state.isAlive).toBe(true);
    expect(state.finished).toBe(false);
    expect(state.didNotFinish).toBe(false);
  });

  it("starts with empty coin/block sets and zero score", () => {
    const state = createInitialRacerState(LEVEL);
    expect(state.collectedCoinIds.size).toBe(0);
    expect(state.resolvedBlockIds.size).toBe(0);
    expect(state.coinsCollected).toBe(0);
    expect(state.fruitScore).toBe(0);
    expect(state.deaths).toBe(0);
    expect(state.timeElapsedMs).toBe(0);
  });
});
