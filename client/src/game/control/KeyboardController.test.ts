import { describe, expect, it } from "vitest";
import { KeyboardController } from "./KeyboardController";

function keys(overrides: Partial<{ left: boolean; right: boolean; space: boolean }> = {}) {
  return {
    left: { isDown: overrides.left ?? false },
    right: { isDown: overrides.right ?? false },
    space: { isDown: overrides.space ?? false },
  };
}

describe("KeyboardController", () => {
  it("returns 'left' when only the left key is down", () => {
    const controller = new KeyboardController(keys({ left: true }));
    expect(controller.getNextAction()).toBe("left");
  });

  it("returns 'right' when only the right key is down", () => {
    const controller = new KeyboardController(keys({ right: true }));
    expect(controller.getNextAction()).toBe("right");
  });

  it("returns 'jump' when the space key is down", () => {
    const controller = new KeyboardController(keys({ space: true }));
    expect(controller.getNextAction()).toBe("jump");
  });

  it("returns 'idle' when no key is down", () => {
    const controller = new KeyboardController(keys());
    expect(controller.getNextAction()).toBe("idle");
  });

  it("prioritizes left over right when both are pressed simultaneously", () => {
    const controller = new KeyboardController(keys({ left: true, right: true }));
    expect(controller.getNextAction()).toBe("left");
  });
});

describe("KeyboardController.getInput", () => {
  it("returns dir=0, jump=false when no key is down", () => {
    const controller = new KeyboardController(keys());
    expect(controller.getInput()).toEqual({ dir: 0, jump: false });
  });

  it("returns dir=-1 when only left is down", () => {
    const controller = new KeyboardController(keys({ left: true }));
    expect(controller.getInput()).toEqual({ dir: -1, jump: false });
  });

  it("returns dir=1 when only right is down", () => {
    const controller = new KeyboardController(keys({ right: true }));
    expect(controller.getInput()).toEqual({ dir: 1, jump: false });
  });

  it("returns jump=true independently of the horizontal direction", () => {
    const controller = new KeyboardController(keys({ space: true }));
    expect(controller.getInput()).toEqual({ dir: 0, jump: true });
  });

  it("allows moving and jumping at the same time (multi-input)", () => {
    const controller = new KeyboardController(keys({ right: true, space: true }));
    expect(controller.getInput()).toEqual({ dir: 1, jump: true });
  });

  it("prioritizes left over right for dir when both are pressed", () => {
    const controller = new KeyboardController(keys({ left: true, right: true }));
    expect(controller.getInput()).toEqual({ dir: -1, jump: false });
  });
});
