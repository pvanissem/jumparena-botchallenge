import type { TournamentShowState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import {
  addShowHold,
  canAdvance,
  enterTimedPhase,
  enterUntimedPhase,
  removeShowHold,
} from "./showPhaseMachine";

function show(overrides: Partial<TournamentShowState> = {}): TournamentShowState {
  return {
    phase: "ready",
    activeMatchId: "match-1",
    activeRoundIndex: 0,
    matchAttemptId: null,
    executorClientId: null,
    phaseEndsAtMs: null,
    heldRemainingMs: null,
    holds: [],
    presentReady: true,
    ...overrides,
  };
}

describe("showPhaseMachine", () => {
  it("enters a timed phase with an absolute deadline", () => {
    const intro = enterTimedPhase(show(), "matchup-intro", 1_000, 5_000);

    expect(intro).toMatchObject({
      phase: "matchup-intro",
      phaseEndsAtMs: 6_000,
      heldRemainingMs: null,
    });
  });

  it("enters an untimed phase without stale timing state", () => {
    const running = enterUntimedPhase(
      show({ phaseEndsAtMs: 6_000, heldRemainingMs: 3_000 }),
      "match-running"
    );

    expect(running).toMatchObject({
      phase: "match-running",
      phaseEndsAtMs: null,
      heldRemainingMs: null,
    });
  });

  it("freezes the remaining time on the first hold", () => {
    const intro = enterTimedPhase(show(), "matchup-intro", 1_000, 5_000);

    const held = addShowHold(intro, "operator", 2_000);

    expect(held).toMatchObject({
      phaseEndsAtMs: null,
      heldRemainingMs: 4_000,
      holds: ["operator"],
    });
  });

  it("adds multiple holds once and keeps the initially frozen duration", () => {
    const held = addShowHold(
      addShowHold(enterTimedPhase(show(), "countdown", 1_000, 3_000), "operator", 2_000),
      "present-unavailable",
      3_000
    );

    expect(held.holds).toEqual(["operator", "present-unavailable"]);
    expect(addShowHold(held, "operator", 3_500)).toBe(held);
    expect(held.heldRemainingMs).toBe(2_000);
  });

  it("resumes only after the final hold is removed", () => {
    const held = show({
      phase: "countdown",
      holds: ["operator", "present-unavailable"],
      heldRemainingMs: 2_000,
    });

    const stillHeld = removeShowHold(held, "operator", 10_000);
    const resumed = removeShowHold(stillHeld, "present-unavailable", 12_000);

    expect(stillHeld).toMatchObject({ phaseEndsAtMs: null, heldRemainingMs: 2_000 });
    expect(resumed).toMatchObject({
      holds: [],
      phaseEndsAtMs: 14_000,
      heldRemainingMs: null,
    });
  });

  it("does not create a new object when removing an unknown hold", () => {
    const current = show();

    expect(removeShowHold(current, "operator", 1_000)).toBe(current);
  });

  it.each(["matchup-intro", "countdown", "match-result", "bracket-update"] as const)(
    "allows manual advance from %s",
    (phase) => expect(canAdvance(show({ phase }))).toBe(true)
  );

  it.each(["ready", "match-running", "champion"] as const)(
    "rejects manual advance from %s",
    (phase) => expect(canAdvance(show({ phase }))).toBe(false)
  );
});
