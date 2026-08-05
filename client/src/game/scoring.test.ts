import { describe, expect, it } from "vitest";
import { computeScore, computeTimeBonus, computeTimeMultiplier, SCORING } from "./scoring";

describe("computeTimeMultiplier", () => {
  it("is highest (1 + max bonus) when no time has elapsed", () => {
    expect(computeTimeMultiplier(0)).toBeCloseTo(1 + SCORING.TIME_MULTIPLIER_MAX_BONUS);
  });

  it("decays linearly towards 1.0 across the time budget", () => {
    const half = SCORING.TIME_BUDGET_MS / 2;
    expect(computeTimeMultiplier(half)).toBeCloseTo(1 + SCORING.TIME_MULTIPLIER_MAX_BONUS / 2);
  });

  it("bottoms out at 1.0 (no penalty) once the budget is exceeded", () => {
    expect(computeTimeMultiplier(SCORING.TIME_BUDGET_MS)).toBeCloseTo(1);
    expect(computeTimeMultiplier(SCORING.TIME_BUDGET_MS + 30_000)).toBeCloseTo(1);
  });
});

describe("computeTimeBonus", () => {
  it("scales linearly with the time left within the budget", () => {
    expect(computeTimeBonus(0)).toBe(SCORING.TIME_BUDGET_MS * SCORING.TIME_BONUS_FACTOR);
    expect(computeTimeBonus(10_000)).toBe(
      (SCORING.TIME_BUDGET_MS - 10_000) * SCORING.TIME_BONUS_FACTOR
    );
  });

  it("returns zero (never negative) once the time budget is exceeded", () => {
    expect(computeTimeBonus(SCORING.TIME_BUDGET_MS)).toBe(0);
    expect(computeTimeBonus(SCORING.TIME_BUDGET_MS + 5_000)).toBe(0);
  });
});

describe("computeScore", () => {
  it("multiplies fruit points by the time multiplier and adds the flat bonus", () => {
    const timeElapsedMs = 10_000;
    const score = computeScore({
      fruitScore: 100,
      timeElapsedMs,
      deaths: 0,
      reachedGoal: true,
    });
    const expected =
      100 * computeTimeMultiplier(timeElapsedMs) + computeTimeBonus(timeElapsedMs);
    expect(score).toBe(Math.round(expected));
  });

  it("applies neither multiplier nor flat bonus after the budget (multiplier 1, bonus 0)", () => {
    const score = computeScore({
      fruitScore: 50,
      timeElapsedMs: SCORING.TIME_BUDGET_MS + 20_000,
      deaths: 0,
      reachedGoal: true,
    });
    expect(score).toBe(50);
  });

  it("applies the DNF penalty and no time reward when the goal was not reached", () => {
    const score = computeScore({
      fruitScore: 30,
      timeElapsedMs: 5_000,
      deaths: 0,
      reachedGoal: false,
    });
    expect(score).toBe(30 - SCORING.DNF_PENALTY);
  });

  it("subtracts a cumulative death penalty and rounds the result", () => {
    const score = computeScore({
      fruitScore: 33.4,
      timeElapsedMs: SCORING.TIME_BUDGET_MS,
      deaths: 2,
      reachedGoal: true,
    });
    // Multiplier is 1.0 and flat bonus 0 at the budget edge.
    expect(score).toBe(Math.round(33.4 - 2 * SCORING.DEATH_PENALTY));
    expect(Number.isInteger(score)).toBe(true);
  });
});
