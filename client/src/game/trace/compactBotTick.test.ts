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
  it("keeps diagnostic fields, rounds numbers, and limits large lists", () => {
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
    expect(sample.coins).toHaveLength(3);
    expect(sample.platforms).toHaveLength(4);
    expect(sample).not.toHaveProperty("tuning");
    expect(sample).not.toHaveProperty("livesRemaining");
  });

  it("produces JSON-safe data even when the source contains Infinity", () => {
    const json = JSON.stringify(compactBotTick(stateFixture()));

    expect(json).not.toContain("Infinity");
    expect(json).not.toContain('null"}');
  });
});
