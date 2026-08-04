import { describe, expect, it } from "vitest";
import { computeScore, SCORING } from "./scoring";

describe("computeScore", () => {
  it("awards a positive time bonus when the goal is reached within the budget", () => {
    const score = computeScore({
      fruitScore: 100,
      timeElapsedMs: 10_000,
      deaths: 0,
      reachedGoal: true,
    });
    const expectedBonus = (SCORING.TIME_BUDGET_MS - 10_000) * SCORING.TIME_BONUS_FACTOR;
    expect(score).toBe(Math.round(100 + expectedBonus));
  });

  it("awards zero (not negative) time bonus when the goal is reached after the budget", () => {
    const score = computeScore({
      fruitScore: 50,
      timeElapsedMs: SCORING.TIME_BUDGET_MS + 20_000,
      deaths: 0,
      reachedGoal: true,
    });
    expect(score).toBe(50);
  });

  it("applies the DNF penalty and no time bonus when the goal was not reached", () => {
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
    expect(score).toBe(Math.round(33.4 - 2 * SCORING.DEATH_PENALTY));
    expect(Number.isInteger(score)).toBe(true);
  });
});
