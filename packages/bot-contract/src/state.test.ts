import { describe, expect, it } from "vitest";
import { ACTIONS, type Action, type BotState, type DecideResult } from "./state";

describe("state contract", () => {
  it("ACTIONS contains exactly the six allowed actions", () => {
    expect(ACTIONS).toEqual(["left", "right", "jump", "idle", "sprint-left", "sprint-right"]);
  });

  it("DecideResult is a list of actions (multi-action per tick)", () => {
    const result: DecideResult = ["jump", "sprint-right"];
    expect(result).toHaveLength(2);
    const empty: DecideResult = [];
    expect(empty).toHaveLength(0);
  });

  it("accepts a fully populated BotState object", () => {
    const state: BotState = {
      tick: 1,
      position: { x: 10, y: 20 },
      facing: "right",
      onGround: true,
      isAlive: true,
      velocity: { vx: 200, vy: 0 },
      isSprinting: false,
      nearbyTiles: [["empty", "solid"]],
      nearestCoin: { dx: 1, dy: -1, value: 10 },
      nearestHazard: {
        dx: -2,
        dy: 0,
        kind: "schnetzler",
        active: true,
        warning: false,
        stompable: true,
      },
      nearestUtility: { dx: 3, dy: 0, kind: "boingo" },
      coins: [{ dx: 1, dy: -1, value: 10 }],
      hazards: [
        { dx: -2, dy: 0, kind: "schnetzler", active: true, warning: false, stompable: true },
      ],
      utilities: [{ dx: 3, dy: 0, kind: "boingo" }],
      goalDirection: { dx: 1, dy: 0 },
      gapAhead: { present: false, distance: null },
      worldBounds: { width: 400, height: 200 },
      justRespawned: false,
      tookDamage: false,
      coinsCollected: 2,
      livesRemaining: 3,
      timeElapsedMs: 1500,
    };

    expect(state.facing).toBe("right");
    expect(state.coins).toHaveLength(1);
    expect(state.nearestHazard).toEqual(state.hazards[0]);
  });

  it("allows null for nearestCoin/nearestHazard/nearestUtility with empty lists", () => {
    const state: BotState = {
      tick: 0,
      position: { x: 0, y: 0 },
      facing: "left",
      onGround: false,
      isAlive: true,
      velocity: { vx: 0, vy: 0 },
      isSprinting: false,
      nearbyTiles: [],
      nearestCoin: null,
      nearestHazard: null,
      nearestUtility: null,
      coins: [],
      hazards: [],
      utilities: [],
      goalDirection: { dx: 0, dy: 0 },
      gapAhead: { present: false, distance: null },
      worldBounds: { width: 400, height: 200 },
      justRespawned: false,
      tookDamage: false,
      coinsCollected: 0,
      livesRemaining: 3,
      timeElapsedMs: 0,
    };

    expect(state.nearestCoin).toBeNull();
    expect(state.coins).toEqual([]);
  });

  it("Action type only allows the six known string values at runtime too", () => {
    const values: Action[] = ["left", "right", "jump", "idle", "sprint-left", "sprint-right"];
    for (const value of values) {
      expect(ACTIONS).toContain(value);
    }
  });
});
