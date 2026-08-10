import { describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { deriveRacerOutcome, type RacerOutcome } from "./racerOutcome";

function baseRacer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: false,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 10,
    livesRemaining: 2,
    deaths: 0,
    timeElapsedMs: 1000,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

describe("deriveRacerOutcome", () => {
  it("returns null while the racer is still running", () => {
    expect(deriveRacerOutcome(baseRacer(), null)).toBeNull();
  });

  it("returns 'goal' when the racer finished", () => {
    expect(deriveRacerOutcome(baseRacer({ finished: true }), null)).toEqual<RacerOutcome>({
      kind: "goal",
      reachedGoal: true,
    });
  });

  it("returns 'out-of-lives' when didNotFinish with no remaining lives", () => {
    expect(
      deriveRacerOutcome(baseRacer({ didNotFinish: true, livesRemaining: 0 }), null)
    ).toEqual<RacerOutcome>({
      kind: "out-of-lives",
      reachedGoal: false,
    });
  });

  it("returns 'time-limit' when didNotFinish with remaining lives", () => {
    expect(
      deriveRacerOutcome(baseRacer({ didNotFinish: true, livesRemaining: 1 }), null)
    ).toEqual<RacerOutcome>({
      kind: "time-limit",
      reachedGoal: false,
    });
  });

  it("returns 'disabled' when paused regardless of other state", () => {
    expect(
      deriveRacerOutcome(baseRacer({ didNotFinish: true, livesRemaining: 0 }), "too-many-failures")
    ).toEqual<RacerOutcome>({
      kind: "disabled",
      reachedGoal: false,
    });
  });

  it("prefers 'goal' over 'disabled' and 'out-of-lives'", () => {
    expect(
      deriveRacerOutcome(
        baseRacer({ finished: true, didNotFinish: true, livesRemaining: 0 }),
        "guard-rejected"
      )
    ).toEqual<RacerOutcome>({
      kind: "goal",
      reachedGoal: true,
    });
  });

  it("prefers 'disabled' over 'out-of-lives'", () => {
    expect(
      deriveRacerOutcome(baseRacer({ didNotFinish: true, livesRemaining: 0 }), "invalid-module")
    ).toEqual<RacerOutcome>({
      kind: "disabled",
      reachedGoal: false,
    });
  });
});
