import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../level/tiles";
import type { LevelDef } from "../level/types";
import { MOVEMENT_TUNING } from "../movement/movement";
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
  sprintHoldMs: 0,
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
      sprintHoldMs: 0,
      justRespawned: true,
      tookDamage: true,
    });
    expect(state.velocity).toEqual({ vx: 200, vy: -50 });
    expect(state.isSprinting).toBe(true);
    expect(state.justRespawned).toBe(true);
    expect(state.tookDamage).toBe(true);
  });

  it("exposes tuning matching MOVEMENT_TUNING/TILE_SIZE/BOT_TICK_INTERVAL_MS", () => {
    const state = build(snapshot(), racer());
    expect(state.tuning).toEqual({
      gravity: MOVEMENT_TUNING.GRAVITY_Y,
      tileSize: TILE_SIZE,
      tickMs: MOVEMENT_TUNING.BOT_TICK_INTERVAL_MS,
      baseMoveSpeed: MOVEMENT_TUNING.BASE_MOVE_SPEED,
      sprintMoveSpeed: MOVEMENT_TUNING.SPRINT_MOVE_SPEED,
      sprintRampMs: MOVEMENT_TUNING.SPRINT_RAMP_MS,
      baseJumpVelocity: MOVEMENT_TUNING.BASE_JUMP_VELOCITY,
      sprintJumpVelocity: MOVEMENT_TUNING.SPRINT_JUMP_VELOCITY,
      minJumpHoldMs: MOVEMENT_TUNING.MIN_JUMP_HOLD_MS,
      botWidth: MOVEMENT_TUNING.PLAYER_BODY_SIZE.width,
      botHeight: MOVEMENT_TUNING.PLAYER_BODY_SIZE.height,
    });
  });

  it("computes sprintRampProgress from sprintHoldMs (0 at 0, 1 at full ramp)", () => {
    const zero = build(snapshot(), racer(), 0, { ...NO_EXTRAS, sprintHoldMs: 0 });
    expect(zero.sprintRampProgress).toBe(0);

    const full = build(snapshot(), racer(), 0, {
      ...NO_EXTRAS,
      sprintHoldMs: MOVEMENT_TUNING.SPRINT_RAMP_MS,
    });
    expect(full.sprintRampProgress).toBe(1);

    const half = build(snapshot(), racer(), 0, {
      ...NO_EXTRAS,
      sprintHoldMs: MOVEMENT_TUNING.SPRINT_RAMP_MS / 2,
    });
    expect(half.sprintRampProgress).toBeCloseTo(0.5);
  });

  it("exposes visible platforms built from level.platforms/hiddenCoinBlocks", () => {
    const level: LevelDef = { ...LEVEL, platforms: [{ x: 0, y: 16, tilesWide: 2 }] };
    const state = build(snapshot({ level }), racer({ x: 0, y: 0 }));
    expect(state.platforms).toMatchObject([
      { dx: 0, dy: 16, width: 32, height: 16, kind: "ground" },
    ]);
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
      { id: "near", dx: -20, dy: 0, value: 5 },
      { id: "mid", dx: 100, dy: 0, value: 8 },
      { id: "far", dx: 200, dy: 0, value: 10 },
    ]);
    expect(state.nearestCoin).toEqual(state.coins[0]);
  });

  it("filters out objects beyond the horizontal view range", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      visibleCoins: [
        { id: "in", x: 400, y: 0, value: 5 }, // exakt auf der Kante -> sichtbar
        { id: "out", x: 401, y: 0, value: 5 },
      ],
    });
    const state = build(snap, r);
    expect(state.coins).toHaveLength(1);
    expect(state.coins[0].dx).toBe(400);
  });

  it("sees objects far above and below, since the camera never scrolls vertically", () => {
    const r = racer({ x: 0, y: 100 });
    const snap = snapshot({
      visibleCoins: [
        { id: "below", x: 0, y: 500, value: 5 },
        { id: "above", x: 0, y: 0, value: 7 },
      ],
    });
    const state = build(snap, r);
    expect(state.coins).toEqual([
      { id: "above", dx: 0, dy: -100, value: 7 },
      { id: "below", dx: 0, dy: 400, value: 5 },
    ]);
  });

  it("marks only ninjafrog as stompable and passes through active/warning", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      hazards: [
        { id: "frog", kind: "ninjafrog", x: 10, y: 0, active: true, warning: false },
        { id: "saw", kind: "schnetzler", x: 20, y: 0, active: true, warning: false },
        { id: "spike", kind: "spikehead", x: 30, y: 0, active: false, warning: true },
      ],
    });
    const state = build(snap, r);
    const frog = state.hazards.find((h) => h.kind === "ninjafrog");
    const saw = state.hazards.find((h) => h.kind === "schnetzler");
    const spike = state.hazards.find((h) => h.kind === "spikehead");
    expect(frog).toEqual({
      id: "frog",
      dx: 10,
      dy: 0,
      kind: "ninjafrog",
      active: true,
      warning: false,
      stompable: true,
      vx: 0,
      vy: 0,
    });
    expect(saw).toEqual({
      id: "saw",
      dx: 20,
      dy: 0,
      kind: "schnetzler",
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    });
    expect(spike).toEqual({
      id: "spike",
      dx: 30,
      dy: 0,
      kind: "spikehead",
      active: false,
      warning: true,
      stompable: false,
      vx: 0,
      vy: 0,
    });
    expect(state.nearestHazard).toEqual(state.hazards[0]);
  });

  it("lists visible utilities with pixel-relative dx/dy", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      utilities: [{ id: "b1", kind: "boingo", x: -40, y: 10 }],
    });
    const state = build(snap, r);
    expect(state.utilities).toEqual([{ id: "b1", dx: -40, dy: 10, kind: "boingo" }]);
    expect(state.nearestUtility).toEqual(state.utilities[0]);
  });

  it("does not list hazards already removed from the snapshot", () => {
    const r = racer({ x: 0, y: 0 });
    const snap = snapshot({
      hazards: [{ id: "alive-frog", kind: "ninjafrog", x: 20, y: 0, active: true, warning: false }],
    });
    const state = build(snap, r);
    expect(state.hazards).toHaveLength(1);
    expect(state.hazards[0].kind).toBe("ninjafrog");
    expect(state.hazards[0].dx).toBe(20);
  });
});

describe("navigation observation v1", () => {
  const navigation = {
    epoch: 2,
    frame: 17,
    observedAtMs: 280,
    physicsStepMs: 1000 / 60,
    body: { x: 64, y: 90, width: 28.8, height: 38.4 },
    movement: {
      jumpStartedAtMs: null,
      impulseKind: "boingo" as const,
      impulseAtMs: 260,
      sourceId: "spring",
    },
  };

  it("keeps sprite-relative offsets and adds body-relative bounds, IDs and absolute navigation geometry", () => {
    const state = build(
      snapshot({
        levelId: "test-level",
        goalBounds: { x: 370, y: 80, width: 40, height: 96 },
        visibleCoins: [
          {
            id: "fruit",
            x: 100,
            y: 80,
            value: 15,
            bounds: { x: 90, y: 70, width: 20, height: 20 },
          },
        ],
      }),
      racer({ x: 80, y: 100 }),
      9,
      { ...NO_EXTRAS, navigation }
    );
    expect(state.coins[0]).toEqual({
      id: "fruit",
      dx: 20,
      dy: -20,
      value: 15,
      bounds: { dx: 10, dy: -30, width: 20, height: 20 },
    });
    expect(state.position).toEqual({ x: 80, y: 100 });
    expect(state.tuning).toMatchObject({ botWidth: 28.8, botHeight: 38.4 });
    expect(state.navigation).toEqual({
      version: 1,
      ...navigation,
      viewport: { x: -320, y: -440, width: 800, height: 1080 },
      goalBounds: { x: 370, y: 80, width: 40, height: 96 },
      boingoJumpVelocity: MOVEMENT_TUNING.BOINGO_JUMP_VELOCITY,
      stompJumpVelocity: -280,
    });
  });

  it("does not expose an unseen goal collider and copies mutable body/movement data", () => {
    const input = {
      ...navigation,
      body: { ...navigation.body },
      movement: { ...navigation.movement },
    };
    const state = build(
      snapshot({ goalBounds: { x: 900, y: 80, width: 40, height: 96 } }),
      racer(),
      0,
      { ...NO_EXTRAS, navigation: input }
    );
    expect(state.navigation).not.toHaveProperty("goalBounds");
    input.body.x = 999;
    input.movement.sourceId = "other";
    expect(state.navigation?.body.x).toBe(64);
    expect(state.navigation?.movement.sourceId).toBe("spring");
  });
});
