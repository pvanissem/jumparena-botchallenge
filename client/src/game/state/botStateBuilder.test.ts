import { describe, expect, it } from "vitest";
import type { LevelDef } from "../level/types";
import type { RacerRuntimeState } from "../rules/racerState";
import { createInitialRacerState } from "../rules/racerState";
import { type BotStateExtras, buildBotState } from "./botStateBuilder";
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

const NO_EXTRAS: BotStateExtras = {
  velocity: { vx: 0, vy: 0 },
  isSprinting: false,
  justRespawned: false,
  tookDamage: false,
};

function build(
  snap: WorldSnapshot,
  r: RacerRuntimeState,
  tick = 0,
  extras: BotStateExtras = NO_EXTRAS
) {
  return buildBotState(snap, r, tick, extras);
}

describe("buildBotState basics", () => {
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
    const state = build(snapshot(), r, 42);

    expect(state.tick).toBe(42);
    expect(state.position).toEqual({ x: 64, y: 100 });
    expect(state.facing).toBe("left");
    expect(state.onGround).toBe(false);
    expect(state.isAlive).toBe(r.isAlive);
    expect(state.coinsCollected).toBe(3);
    expect(state.livesRemaining).toBe(2);
    expect(state.timeElapsedMs).toBe(5000);
  });

  it("exposes worldBounds and goalDirection in pixels", () => {
    const r = racer({ x: 80, y: 44 });
    const state = build(snapshot(), r);
    expect(state.worldBounds).toEqual({ width: 400, height: 200 });
    expect(state.goalDirection).toEqual({ dx: 380 - 80, dy: 144 - 44 });
  });

  it("passes through the extras (velocity/isSprinting/justRespawned/tookDamage)", () => {
    const state = build(snapshot(), racer(), 0, {
      velocity: { vx: 200, vy: -50 },
      isSprinting: true,
      justRespawned: true,
      tookDamage: true,
    });
    expect(state.velocity).toEqual({ vx: 200, vy: -50 });
    expect(state.isSprinting).toBe(true);
    expect(state.justRespawned).toBe(true);
    expect(state.tookDamage).toBe(true);
  });
});

describe("buildBotState coin/hazard/utility lists", () => {
  it("returns empty lists and null nearest* when nothing is visible", () => {
    const state = build(snapshot(), racer());
    expect(state.coins).toEqual([]);
    expect(state.hazards).toEqual([]);
    expect(state.utilities).toEqual([]);
    expect(state.nearestCoin).toBeNull();
    expect(state.nearestHazard).toBeNull();
    expect(state.nearestUtility).toBeNull();
  });

  it("lists all visible coins sorted by distance, with pixel-relative dx/dy", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      visibleCoins: [
        { id: "far", x: 200, y: 0, value: 10 },
        { id: "near", x: -20, y: 0, value: 5 },
        { id: "mid", x: 100, y: 0, value: 8 },
      ],
    });
    const state = build(snap, r);
    expect(state.coins).toEqual([
      { dx: -20, dy: 0, value: 5 },
      { dx: 100, dy: 0, value: 8 },
      { dx: 200, dy: 0, value: 10 },
    ]);
    expect(state.nearestCoin).toEqual(state.coins[0]);
  });

  it("filters out objects beyond the view radius", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      visibleCoins: [
        { id: "in", x: 300, y: 0, value: 5 },
        { id: "out", x: 400, y: 0, value: 5 }, // 400 > 320 radius
      ],
    });
    const state = build(snap, r);
    expect(state.coins).toHaveLength(1);
    expect(state.coins[0].dx).toBe(300);
  });

  it("marks only schnetzler as stompable and passes through active/warning", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      hazards: [
        { id: "saw", kind: "schnetzler", x: 10, y: 0, active: true, warning: false },
        { id: "spike", kind: "spikehead", x: 20, y: 0, active: false, warning: true },
      ],
    });
    const state = build(snap, r);
    const saw = state.hazards.find((h) => h.kind === "schnetzler");
    const spike = state.hazards.find((h) => h.kind === "spikehead");
    expect(saw).toEqual({
      dx: 10,
      dy: 0,
      kind: "schnetzler",
      active: true,
      warning: false,
      stompable: true,
    });
    expect(spike).toEqual({
      dx: 20,
      dy: 0,
      kind: "spikehead",
      active: false,
      warning: true,
      stompable: false,
    });
    expect(state.nearestHazard).toEqual(state.hazards[0]);
  });

  it("lists visible utilities with pixel-relative dx/dy", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      utilities: [{ id: "b1", kind: "boingo", x: -40, y: 10 }],
    });
    const state = build(snap, r);
    expect(state.utilities).toEqual([{ dx: -40, dy: 10, kind: "boingo" }]);
    expect(state.nearestUtility).toEqual(state.utilities[0]);
  });
});
