import { describe, expect, it } from "vitest";
import {
  jumpVelocityForSpeed,
  MOVEMENT_TUNING,
  rampedSprintSpeed,
  shouldCutJump,
} from "./movement";

describe("rampedSprintSpeed", () => {
  it("returns BASE_MOVE_SPEED at sprintHoldMs=0", () => {
    expect(rampedSprintSpeed(0)).toBe(MOVEMENT_TUNING.BASE_MOVE_SPEED);
  });

  it("returns SPRINT_MOVE_SPEED once SPRINT_RAMP_MS has elapsed", () => {
    expect(rampedSprintSpeed(MOVEMENT_TUNING.SPRINT_RAMP_MS)).toBe(
      MOVEMENT_TUNING.SPRINT_MOVE_SPEED
    );
  });

  it("interpolates linearly at the halfway point", () => {
    const half = MOVEMENT_TUNING.SPRINT_RAMP_MS / 2;
    const expected =
      MOVEMENT_TUNING.BASE_MOVE_SPEED +
      (MOVEMENT_TUNING.SPRINT_MOVE_SPEED - MOVEMENT_TUNING.BASE_MOVE_SPEED) * 0.5;
    expect(rampedSprintSpeed(half)).toBeCloseTo(expected);
  });

  it("clamps values beyond SPRINT_RAMP_MS to SPRINT_MOVE_SPEED", () => {
    expect(rampedSprintSpeed(MOVEMENT_TUNING.SPRINT_RAMP_MS * 10)).toBe(
      MOVEMENT_TUNING.SPRINT_MOVE_SPEED
    );
  });

  it("clamps negative values to BASE_MOVE_SPEED", () => {
    expect(rampedSprintSpeed(-100)).toBe(MOVEMENT_TUNING.BASE_MOVE_SPEED);
  });
});

describe("jumpVelocityForSpeed", () => {
  it("returns BASE_JUMP_VELOCITY at BASE_MOVE_SPEED", () => {
    expect(jumpVelocityForSpeed(MOVEMENT_TUNING.BASE_MOVE_SPEED)).toBe(
      MOVEMENT_TUNING.BASE_JUMP_VELOCITY
    );
  });

  it("returns SPRINT_JUMP_VELOCITY at SPRINT_MOVE_SPEED", () => {
    expect(jumpVelocityForSpeed(MOVEMENT_TUNING.SPRINT_MOVE_SPEED)).toBe(
      MOVEMENT_TUNING.SPRINT_JUMP_VELOCITY
    );
  });

  it("interpolates linearly at the halfway point", () => {
    const halfSpeed = (MOVEMENT_TUNING.BASE_MOVE_SPEED + MOVEMENT_TUNING.SPRINT_MOVE_SPEED) / 2;
    const expected =
      MOVEMENT_TUNING.BASE_JUMP_VELOCITY +
      (MOVEMENT_TUNING.SPRINT_JUMP_VELOCITY - MOVEMENT_TUNING.BASE_JUMP_VELOCITY) * 0.5;
    expect(jumpVelocityForSpeed(halfSpeed)).toBeCloseTo(expected);
  });

  it("clamps speeds below BASE_MOVE_SPEED to BASE_JUMP_VELOCITY (no extrapolation)", () => {
    expect(jumpVelocityForSpeed(0)).toBe(MOVEMENT_TUNING.BASE_JUMP_VELOCITY);
  });

  it("clamps speeds above SPRINT_MOVE_SPEED to SPRINT_JUMP_VELOCITY (no extrapolation)", () => {
    expect(jumpVelocityForSpeed(MOVEMENT_TUNING.SPRINT_MOVE_SPEED * 2)).toBe(
      MOVEMENT_TUNING.SPRINT_JUMP_VELOCITY
    );
  });
});

describe("shouldCutJump", () => {
  it("never cuts while the jump button/action is held", () => {
    expect(shouldCutJump(0, true)).toBe(false);
    expect(shouldCutJump(10_000, true)).toBe(false);
  });

  it("does not cut before the minimum hold time has elapsed, even when released", () => {
    expect(shouldCutJump(0, false)).toBe(false);
    expect(shouldCutJump(MOVEMENT_TUNING.MIN_JUMP_HOLD_MS - 1, false)).toBe(false);
  });

  it("cuts once the minimum hold time has elapsed and the button is released", () => {
    expect(shouldCutJump(MOVEMENT_TUNING.MIN_JUMP_HOLD_MS, false)).toBe(true);
    expect(shouldCutJump(MOVEMENT_TUNING.MIN_JUMP_HOLD_MS + 500, false)).toBe(true);
  });

  it("respects a custom minHoldMs override", () => {
    expect(shouldCutJump(50, false, 100)).toBe(false);
    expect(shouldCutJump(100, false, 100)).toBe(true);
  });
});
