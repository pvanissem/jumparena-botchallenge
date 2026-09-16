import type { BotState } from "@arena/bot-contract";
import { describe, expect, it } from "vitest";
import { compactBotTick } from "./compactBotTick";

function stateFixture(): BotState {
  return {
    tick: 7,
    position: { x: 12.3456, y: 98.7654 },
    facing: "right",
    onGround: false,
    isAlive: true,
    velocity: { vx: 201.234, vy: -123.456 },
    isSprinting: true,
    sprintRampProgress: 0.4567,
    nearbyTiles: [["empty", "solid"]],
    platforms: Array.from({ length: 6 }, (_, i) => ({
      dx: i + 0.123,
      dy: i + 0.456,
      width: 16,
      height: 16,
      kind: "ground" as const,
    })),
    tuning: {
      gravity: 900,
      tileSize: 16,
      tickMs: 33,
      baseMoveSpeed: 200,
      sprintMoveSpeed: 320,
      sprintRampMs: 450,
      baseJumpVelocity: -560,
      sprintJumpVelocity: -650,
      minJumpHoldMs: 180,
      botWidth: 24,
      botHeight: 32,
    },
    coins: Array.from({ length: 5 }, (_, i) => ({ dx: i + 0.111, dy: -i, value: i + 5 })),
    hazards: [
      {
        dx: 20.444,
        dy: 1.555,
        kind: "stachlinger",
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ],
    utilities: [],
    nearestCoin: { dx: 0.111, dy: 0, value: 5 },
    nearestHazard: null,
    nearestUtility: null,
    goalDirection: { dx: 450.678, dy: -2.345 },
    gapAhead: { present: true, distance: 31.789 },
    worldBounds: { width: 800, height: 540 },
    justRespawned: false,
    tookDamage: false,
    coinsCollected: 2,
    livesRemaining: Number.POSITIVE_INFINITY,
    timeElapsedMs: 1234.56,
  };
}

describe("compactBotTick", () => {
  it("keeps diagnostic fields and visible geometry beyond legacy list prefixes", () => {
    const sample = compactBotTick(stateFixture());

    expect(sample).toMatchObject({
      tick: 7,
      timeMs: 1235,
      position: { x: 12.35, y: 98.77 },
      velocity: { vx: 201.23, vy: -123.46 },
      sprintRampProgress: 0.46,
      gapAhead: { present: true, distance: 31.79 },
      decision: null,
    });
    expect(sample.coins).toHaveLength(5);
    expect(sample.platforms).toHaveLength(6);
    expect(sample).not.toHaveProperty("tuning");
    expect(sample).not.toHaveProperty("livesRemaining");
  });

  it("copies utilities, bounds, body, impulse and observation correlation without aliases", () => {
    const state = stateFixture();
    state.utilities = [
      {
        id: "boingo-1",
        kind: "boingo",
        dx: 20,
        dy: 30,
        bounds: { dx: 10, dy: 20, width: 20, height: 20 },
      },
    ];
    state.platforms[5] = {
      ...state.platforms[5],
      id: "landing",
      collision: "one-way-up",
      bounds: { dx: 5, dy: 6, width: 16, height: 16 },
    };
    state.navigation = {
      version: 1,
      epoch: 3,
      frame: 77,
      observedAtMs: 1234.56,
      physicsStepMs: 1000 / 60,
      body: { x: 1.23456, y: 2, width: 24, height: 32 },
      movement: {
        jumpStartedAtMs: null,
        impulseKind: "boingo",
        impulseAtMs: 1200,
        sourceId: "boingo-1",
      },
      viewport: { x: 0, y: 0, width: 800, height: 540 },
      boingoJumpVelocity: -700,
      stompJumpVelocity: -400,
    };
    const sample = compactBotTick(state);
    expect(sample).toMatchObject({
      stateTick: 7,
      epoch: 3,
      stateFrame: 77,
      navigation: state.navigation,
      utilities: state.utilities,
    });
    expect(sample.platforms[5]).toEqual({ ...state.platforms[5], dx: 5.12, dy: 5.46 });
    state.utilities[0].bounds = { dx: 10, dy: 20, width: 999, height: 20 };
    state.navigation.body.width = 999;
    expect(sample.utilities?.[0].bounds?.width).toBe(20);
    expect(sample.navigation?.body.width).toBe(24);
  });

  it("produces JSON-safe data even when the source contains Infinity", () => {
    const json = JSON.stringify(compactBotTick(stateFixture()));

    expect(json).not.toContain("Infinity");
    expect(json).not.toContain('null"}');
  });
});
