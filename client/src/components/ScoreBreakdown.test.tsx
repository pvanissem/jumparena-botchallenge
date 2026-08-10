import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { ScoreBreakdown } from "./ScoreBreakdown";

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: false,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 50,
    livesRemaining: 2,
    deaths: 1,
    timeElapsedMs: 12_345,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

describe("ScoreBreakdown", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the fruit score", () => {
    render(<ScoreBreakdown racer={racer()} />);
    expect(screen.getByText(/früchte/i).nextElementSibling?.textContent).toBe("50");
  });

  it("shows time multiplier and flat bonus when the goal was reached", () => {
    render(<ScoreBreakdown racer={racer({ finished: true })} />);
    expect(screen.getByText(/zeit-multiplikator/i)).toBeTruthy();
    expect(screen.getByText(/flat-bonus/i)).toBeTruthy();
    expect(screen.queryByText(/dnf-strafe/i)).toBeNull();
  });

  it("shows the DNF penalty when the goal was not reached", () => {
    render(<ScoreBreakdown racer={racer()} />);
    expect(screen.getByText(/dnf-strafe/i)).toBeTruthy();
    expect(screen.queryByText(/zeit-multiplikator/i)).toBeNull();
    expect(screen.queryByText(/flat-bonus/i)).toBeNull();
  });

  it("shows the death penalty only when deaths are greater than zero", () => {
    render(<ScoreBreakdown racer={racer({ deaths: 0 })} />);
    expect(screen.queryByText(/tode/i)).toBeNull();

    cleanup();
    render(<ScoreBreakdown racer={racer({ deaths: 2 })} />);
    expect(screen.getByText(/tode \(2\)/i)).toBeTruthy();
  });

  it("formats elapsed time in seconds", () => {
    render(<ScoreBreakdown racer={racer({ timeElapsedMs: 12_345 })} />);
    expect(screen.getByText(/zeit/i).nextElementSibling?.textContent).toBe("12.3s");
  });
});
