import type { TournamentShowState } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useShowCountdown } from "./useShowCountdown";

function show(overrides: Partial<TournamentShowState> = {}): TournamentShowState {
  return {
    phase: "countdown",
    activeMatchId: "m1",
    activeRoundIndex: 0,
    matchAttemptId: null,
    executorClientId: null,
    phaseEndsAtMs: 13_000,
    heldRemainingMs: null,
    holds: [],
    presentReady: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useShowCountdown", () => {
  it("counts against corrected server time and never becomes negative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result } = renderHook(() => useShowCountdown(show(), 1_000));
    expect(result.current).toBe(2);

    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current).toBe(0);
  });

  it("returns null for holds and untimed phases", () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: TournamentShowState }) => useShowCountdown(current, 0),
      { initialProps: { current: show({ holds: ["operator"], phaseEndsAtMs: null }) } }
    );
    expect(result.current).toBeNull();

    rerender({ current: show({ phase: "match-running", phaseEndsAtMs: null }) });
    expect(result.current).toBeNull();
  });
});
