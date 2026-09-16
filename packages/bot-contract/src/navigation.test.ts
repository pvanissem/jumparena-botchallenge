import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  BotModule,
  BotState,
  NavigationObservation,
  ToolsApi,
  VisibleCoin,
  VisibleHazard,
  VisiblePlatform,
  VisibleUtility,
} from "./index";

describe("additive navigation contract", () => {
  it("supports versioned observation without making it mandatory for legacy states", () => {
    const observation: NavigationObservation = {
      version: 1,
      epoch: 1,
      frame: 2,
      observedAtMs: 33,
      physicsStepMs: 1000 / 60,
      body: { x: 0, y: 0, width: 24, height: 32 },
      viewport: { x: 0, y: 0, width: 400, height: 200 },
      goalBounds: { x: 300, y: 0, width: 32, height: 48 },
      movement: {
        jumpStartedAtMs: null,
        impulseKind: "boingo",
        impulseAtMs: 30,
        sourceId: "boingo-1",
      },
      boingoJumpVelocity: -700,
      stompJumpVelocity: -400,
    };
    expectTypeOf<BotState["navigation"]>().toEqualTypeOf<NavigationObservation | undefined>();
    expect(observation.movement.impulseKind).toBe("boingo");
  });

  it("adds optional identities and relative bounds without changing dx/dy", () => {
    const bounds = { dx: -12, dy: -16, width: 24, height: 32 };
    const coin: VisibleCoin = { id: "coin-1", dx: 0, dy: 0, value: 10, bounds };
    const utility: VisibleUtility = { id: "utility-1", dx: 0, dy: 0, kind: "boingo", bounds };
    const hazard: VisibleHazard = {
      id: "hazard-1",
      dx: 0,
      dy: 0,
      kind: "schnetzler",
      bounds,
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    };
    const platform: VisiblePlatform = {
      id: "platform-1",
      dx: 0,
      dy: 16,
      width: 64,
      height: 16,
      kind: "float",
      collision: "one-way-up",
      bounds,
    };
    expect([coin, utility, hazard, platform].map((object) => object.bounds)).toEqual(
      Array(4).fill(bounds)
    );
    expectTypeOf<VisiblePlatform["collision"]>().toEqualTypeOf<
      "solid" | "one-way-up" | undefined
    >();
  });

  it("types tools bots and strategy route selection while preserving legacy modules", () => {
    const old: BotModule = { apiVersion: 1, decide: () => [] };
    const bot: BotModule = {
      apiVersion: 1,
      frameworkVersion: 2,
      decide(_state, tools) {
        expectTypeOf(tools).toEqualTypeOf<ToolsApi>();
        return tools.run({ id: "walk-1", kind: "walk", x: 150 });
      },
    };
    expect(old.apiVersion).toBe(bot.apiVersion);
  });
});
