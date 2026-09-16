import { describe, expect, it } from "vitest";
import { createPhysicsConfig } from "./physicsConfig";

describe("shared arena physics", () => {
  it("uses the same explicit 60Hz arcade physics for every host", () => {
    expect(createPhysicsConfig()).toEqual({
      default: "arcade",
      arcade: { gravity: { x: 0, y: 900 }, fixedStep: true, fps: 60, debug: false },
    });
    expect(createPhysicsConfig(true).arcade.debug).toBe(true);
  });
});
