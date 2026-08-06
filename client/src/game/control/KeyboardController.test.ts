import { describe, expect, it } from "vitest";
import { KeyboardController } from "./KeyboardController";

function keys(
  overrides: Partial<{ left: boolean; right: boolean; space: boolean; shift: boolean }> = {}
) {
  return {
    left: { isDown: overrides.left ?? false },
    right: { isDown: overrides.right ?? false },
    space: { isDown: overrides.space ?? false },
    shift: { isDown: overrides.shift ?? false },
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

  it("returns 'sprint-left' when left+shift are held", () => {
    const controller = new KeyboardController(keys({ left: true, shift: true }));
    expect(controller.getNextAction()).toBe("sprint-left");
  });

  it("returns 'sprint-right' when right+shift are held", () => {
    const controller = new KeyboardController(keys({ right: true, shift: true }));
    expect(controller.getNextAction()).toBe("sprint-right");
  });

  it("does not sprint on shift alone (no direction held)", () => {
    const controller = new KeyboardController(keys({ shift: true }));
    expect(controller.getNextAction()).toBe("idle");
  });

  it("prefers sprint over jump when a direction+shift+space are all held", () => {
    const controller = new KeyboardController(keys({ right: true, shift: true, space: true }));
    expect(controller.getNextAction()).toBe("sprint-right");
  });
});

describe("KeyboardController.getInput", () => {
  it("returns dir=0, jump=false, sprint=false when no key is down", () => {
    const controller = new KeyboardController(keys());
    expect(controller.getInput()).toEqual({ dir: 0, jump: false, sprint: false });
  });

  it("returns dir=-1 when only left is down", () => {
    const controller = new KeyboardController(keys({ left: true }));
    expect(controller.getInput()).toEqual({ dir: -1, jump: false, sprint: false });
  });

  it("returns dir=1 when only right is down", () => {
    const controller = new KeyboardController(keys({ right: true }));
    expect(controller.getInput()).toEqual({ dir: 1, jump: false, sprint: false });
  });

  it("returns jump=true independently of the horizontal direction", () => {
    const controller = new KeyboardController(keys({ space: true }));
    expect(controller.getInput()).toEqual({ dir: 0, jump: true, sprint: false });
  });

  it("allows moving and jumping at the same time (multi-input)", () => {
    const controller = new KeyboardController(keys({ right: true, space: true }));
    expect(controller.getInput()).toEqual({ dir: 1, jump: true, sprint: false });
  });

  it("prioritizes left over right for dir when both are pressed", () => {
    const controller = new KeyboardController(keys({ left: true, right: true }));
    expect(controller.getInput()).toEqual({ dir: -1, jump: false, sprint: false });
  });

  it("returns sprint=true when shift is held (independent of direction)", () => {
    const controller = new KeyboardController(keys({ right: true, shift: true }));
    expect(controller.getInput()).toEqual({ dir: 1, jump: false, sprint: true });
  });

  it("allows sprinting and jumping at the same time (multi-input)", () => {
    const controller = new KeyboardController(keys({ right: true, shift: true, space: true }));
    expect(controller.getInput()).toEqual({ dir: 1, jump: true, sprint: true });
  });
});
