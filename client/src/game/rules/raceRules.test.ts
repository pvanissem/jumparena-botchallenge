import { describe, expect, it } from "vitest";
import type { LevelDef } from "../level/types";
import {
  applyBlockHit,
  applyCheckpointReached,
  applyCoinPickup,
  applyGoalReached,
  applyHazardContact,
  applyPitFall,
  applyTimeLimitReached,
  resolveHazardContact,
} from "./raceRules";
import { createInitialRacerState } from "./racerState";

const LEVEL: LevelDef = {
  worldWidth: 100,
  worldHeight: 100,
  groundY: 80,
  spawn: { x: 10, y: 58 },
  goal: { x: 90, y: 58 },
  platforms: [],
  coins: [],
  hiddenCoinBlocks: [],
  checkpoints: [],
  hazards: [],
  utilities: [],
};

describe("applyCoinPickup", () => {
  it("increases coinsCollected and fruitScore and records the coin id", () => {
    const state = createInitialRacerState(LEVEL);
    const next = applyCoinPickup(state, "coin-1", 10);
    expect(next.coinsCollected).toBe(1);
    expect(next.fruitScore).toBe(10);
    expect(next.collectedCoinIds.has("coin-1")).toBe(true);
  });
});

describe("applyBlockHit", () => {
  it("marks the block as resolved without changing other fields", () => {
    const state = createInitialRacerState(LEVEL);
    const next = applyBlockHit(state, "block-1");
    expect(next.resolvedBlockIds.has("block-1")).toBe(true);
    expect(next.coinsCollected).toBe(state.coinsCollected);
    expect(next.livesRemaining).toBe(state.livesRemaining);
  });
});

describe("resolveHazardContact", () => {
  it("returns 'stomped' for a stompable hazard hit from above while active", () => {
    expect(resolveHazardContact("schnetzler", true, true)).toBe("stomped");
  });

  it("returns 'hit' for a stompable hazard hit from the side while active", () => {
    expect(resolveHazardContact("schnetzler", true, false)).toBe("hit");
  });

  it("returns 'hit' for non-stompable hazards regardless of contact direction", () => {
    expect(resolveHazardContact("stachlinger", true, true)).toBe("hit");
    expect(resolveHazardContact("loderix", true, false)).toBe("hit");
    expect(resolveHazardContact("kugelblitz", true, true)).toBe("hit");
  });

  it("returns 'none' when the hazard is not currently active", () => {
    expect(resolveHazardContact("loderix", false, false)).toBe("none");
    expect(resolveHazardContact("schnetzler", false, true)).toBe("none");
  });
});

describe("applyHazardContact", () => {
  it("'hit' loses a life and respawns at lastCheckpoint, 32px above it", () => {
    const state = {
      ...createInitialRacerState(LEVEL),
      x: 50,
      y: 50,
      lastCheckpoint: { x: 20, y: 58 },
    };
    const next = applyHazardContact(state, "hit");
    expect(next.livesRemaining).toBe(state.livesRemaining - 1);
    expect(next.deaths).toBe(state.deaths + 1);
    expect(next.x).toBe(20);
    expect(next.y).toBe(26);
  });

  it("'stomped' does not change the racer state", () => {
    const state = createInitialRacerState(LEVEL);
    const next = applyHazardContact(state, "stomped");
    expect(next).toEqual(state);
  });

  it("marks the racer as didNotFinish/not alive when the last life is lost", () => {
    const state = { ...createInitialRacerState(LEVEL), livesRemaining: 1 };
    const next = applyHazardContact(state, "hit");
    expect(next.livesRemaining).toBe(0);
    expect(next.didNotFinish).toBe(true);
    expect(next.isAlive).toBe(false);
  });
});

describe("applyPitFall", () => {
  it("behaves like a hazard 'hit'", () => {
    const state = { ...createInitialRacerState(LEVEL), x: 50, y: 50 };
    const next = applyPitFall(state);
    expect(next.livesRemaining).toBe(state.livesRemaining - 1);
    expect(next.x).toBe(state.lastCheckpoint.x);
    expect(next.y).toBe(state.lastCheckpoint.y - 32);
  });

  it("never runs out of lives / never sets didNotFinish with Infinity starting lives (/dev)", () => {
    const state = createInitialRacerState(LEVEL, Number.POSITIVE_INFINITY);
    const next = applyPitFall(applyPitFall(applyPitFall(state)));
    expect(next.livesRemaining).toBe(Number.POSITIVE_INFINITY);
    expect(next.didNotFinish).toBe(false);
    expect(next.isAlive).toBe(true);
  });
});

describe("applyCheckpointReached", () => {
  it("updates lastCheckpoint to the new checkpoint position", () => {
    const state = createInitialRacerState(LEVEL);
    const next = applyCheckpointReached(state, { id: "cp-1", x: 55, y: 58 });
    expect(next.lastCheckpoint).toEqual({ x: 55, y: 58 });
  });
});

describe("applyGoalReached", () => {
  it("marks the run as finished", () => {
    const state = createInitialRacerState(LEVEL);
    const next = applyGoalReached(state);
    expect(next.finished).toBe(true);
  });
});

describe("applyTimeLimitReached", () => {
  it("marks didNotFinish when not already finished", () => {
    const state = createInitialRacerState(LEVEL);
    const next = applyTimeLimitReached(state);
    expect(next.didNotFinish).toBe(true);
  });

  it("does not override an already finished run", () => {
    const state = applyGoalReached(createInitialRacerState(LEVEL));
    const next = applyTimeLimitReached(state);
    expect(next.didNotFinish).toBe(false);
    expect(next.finished).toBe(true);
  });
});
