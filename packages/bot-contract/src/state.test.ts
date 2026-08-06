import { describe, expect, it } from "vitest";
import { ACTIONS, type Action, type BotState } from "./state";

describe("state contract", () => {
  it("ACTIONS contains exactly the six allowed actions", () => {
    expect(ACTIONS).toEqual(["left", "right", "jump", "idle", "sprint-left", "sprint-right"]);
  });

  it("accepts a fully populated BotState object", () => {
    const state: BotState = {
      tick: 1,
      position: { x: 10, y: 20 },
      facing: "right",
      onGround: true,
      isAlive: true,
      nearbyTiles: [["empty", "solid"]],
      nearestCoin: { dx: 1, dy: -1, value: 10 },
      nearestHazard: { dx: -2, dy: 0, kind: "schnetzler", active: true },
      nearestUtility: { dx: 3, dy: 0, kind: "boingo" },
      goalDirection: { dx: 1, dy: 0 },
      coinsCollected: 2,
      livesRemaining: 3,
      timeElapsedMs: 1500,
    };

    expect(state.facing).toBe("right");
  });

  it("allows null for nearestCoin/nearestHazard/nearestUtility", () => {
    const state: BotState = {
      tick: 0,
      position: { x: 0, y: 0 },
      facing: "left",
      onGround: false,
      isAlive: true,
      nearbyTiles: [],
      nearestCoin: null,
      nearestHazard: null,
      nearestUtility: null,
      goalDirection: { dx: 0, dy: 0 },
      coinsCollected: 0,
      livesRemaining: 3,
      timeElapsedMs: 0,
    };

    expect(state.nearestCoin).toBeNull();
  });

  it("Action type only allows the six known string values at runtime too", () => {
    const values: Action[] = ["left", "right", "jump", "idle", "sprint-left", "sprint-right"];
    for (const value of values) {
      expect(ACTIONS).toContain(value);
    }
  });
});
