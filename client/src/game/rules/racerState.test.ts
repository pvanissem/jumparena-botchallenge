import { describe, expect, it } from "vitest";
import type { LevelDef } from "../level/types";
import { LIVES_PER_RUN } from "./raceRules";
import { createInitialRacerState, isRacerTerminal } from "./racerState";

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

  it("starts above an existing checkpoint with fresh world progress and its real respawn position", () => {
    const level = { ...LEVEL, checkpoints: [{ id: "checkpoint", x: 70, y: 90 }] };
    const state = createInitialRacerState(level, 4, "checkpoint");
    expect(state).toMatchObject({
      x: 70,
      y: 10,
      lastCheckpoint: { x: 70, y: 90 },
      livesRemaining: 4,
      coinsCollected: 0,
      fruitScore: 0,
      deaths: 0,
      timeElapsedMs: 0,
    });
    expect(state.collectedCoinIds.size).toBe(0);
    expect(state.resolvedBlockIds.size).toBe(0);
    expect(state.destroyedHazardIds.size).toBe(0);
    expect(state.hazardTriggeredAtMs.size).toBe(0);
    expect(level.spawn).toEqual({ x: 42, y: 58 });
  });

  it("falls back to the normal start if a checkpoint is absent from the chosen level", () => {
    expect(createInitialRacerState(LEVEL, 3, "missing")).toMatchObject({
      x: 42,
      y: 58,
      lastCheckpoint: { x: 42, y: 58 },
    });
  });

  it("does not claim ground contact before physics at spawn or checkpoint", () => {
    expect(createInitialRacerState(LEVEL).onGround).toBe(false);
    expect(
      createInitialRacerState({ ...LEVEL, checkpoints: [{ id: "cp", x: 70, y: 90 }] }, 3, "cp")
        .onGround
    ).toBe(false);
  });

  it("starts with full lives, alive, not finished", () => {
    const state = createInitialRacerState(LEVEL);
    expect(state.livesRemaining).toBe(LIVES_PER_RUN);
    expect(state.isAlive).toBe(true);
    expect(state.finished).toBe(false);
    expect(state.didNotFinish).toBe(false);
  });

  it("accepts a custom starting lives count (e.g. Infinity for /dev testing)", () => {
    const state = createInitialRacerState(LEVEL, Number.POSITIVE_INFINITY);
    expect(state.livesRemaining).toBe(Number.POSITIVE_INFINITY);
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

describe("isRacerTerminal", () => {
  it("is false for a freshly started racer", () => {
    expect(isRacerTerminal(createInitialRacerState(LEVEL))).toBe(false);
  });

  it("is true once the goal has been reached", () => {
    const state = { ...createInitialRacerState(LEVEL), finished: true };
    expect(isRacerTerminal(state)).toBe(true);
  });

  it("is true once the racer is out (no lives / time limit)", () => {
    const state = { ...createInitialRacerState(LEVEL), didNotFinish: true };
    expect(isRacerTerminal(state)).toBe(true);
  });
});
