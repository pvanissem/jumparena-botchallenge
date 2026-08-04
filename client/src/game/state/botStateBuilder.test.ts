import { describe, expect, it } from "vitest";
import type { LevelDef } from "../level/types";
import type { RacerRuntimeState } from "../rules/racerState";
import { createInitialRacerState } from "../rules/racerState";
import { buildBotState } from "./botStateBuilder";
import type { WorldSnapshot } from "./worldSnapshot";

const LEVEL: LevelDef = {
  worldWidth: 400,
  worldHeight: 200,
  groundY: 160,
  spawn: { x: 32, y: 144 },
  goal: { x: 380, y: 144 },
  platforms: [],
  coins: [],
  hiddenCoinBlocks: [],
  checkpoints: [],
  hazards: [],
  utilities: [],
};

function snapshot(overrides: Partial<WorldSnapshot> = {}): WorldSnapshot {
  return {
    level: LEVEL,
    dynamic: { activeHazardIds: new Set(), resolvedBlockIds: new Set() },
    visibleCoins: [],
    hazards: [],
    utilities: [],
    ...overrides,
  };
}

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return { ...createInitialRacerState(LEVEL), ...overrides };
}

describe("buildBotState", () => {
  it("copies basic fields 1:1 from the racer state", () => {
    const r = racer({
      x: 64,
      y: 100,
      facing: "left",
      onGround: false,
      coinsCollected: 3,
      livesRemaining: 2,
      timeElapsedMs: 5000,
    });
    const state = buildBotState(snapshot(), r, 42);

    expect(state.tick).toBe(42);
    expect(state.position).toEqual({ x: 64, y: 100 });
    expect(state.facing).toBe("left");
    expect(state.onGround).toBe(false);
    expect(state.isAlive).toBe(r.isAlive);
    expect(state.coinsCollected).toBe(3);
    expect(state.livesRemaining).toBe(2);
    expect(state.timeElapsedMs).toBe(5000);
  });

  it("picks the nearest coin among multiple candidates", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      visibleCoins: [
        { id: "far", x: 200, y: 0, value: 10 },
        { id: "near", x: 20, y: 0, value: 5 },
      ],
    });
    const state = buildBotState(snap, r, 0);
    expect(state.nearestCoin).toEqual({ dx: 20, dy: 0, value: 5 });
  });

  it("returns null for nearestCoin/nearestHazard/nearestUtility when none exist", () => {
    const state = buildBotState(snapshot(), racer(), 0);
    expect(state.nearestCoin).toBeNull();
    expect(state.nearestHazard).toBeNull();
    expect(state.nearestUtility).toBeNull();
  });

  it("reflects the dynamic active state on nearestHazard.active", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      hazards: [{ id: "h1", kind: "loderix", x: 10, y: 0, active: false }],
      dynamic: { activeHazardIds: new Set(), resolvedBlockIds: new Set() },
    });
    const state = buildBotState(snap, r, 0);
    expect(state.nearestHazard).toEqual({ dx: 10, dy: 0, kind: "loderix", active: false });
  });
});
