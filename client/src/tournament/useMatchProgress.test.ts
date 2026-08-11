import type { MatchProgressMessage, OutboundMessage } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMatchProgress } from "./useMatchProgress";

function progress(matchId: string): MatchProgressMessage {
  return {
    type: "match-progress",
    matchId,
    matchAttemptId: "attempt-1",
    entries: [
      {
        botId: "b1",
        fruitScore: 10,
        livesRemaining: 2,
        timeElapsedMs: 1000,
        progress: 0.25,
        finished: false,
        didNotFinish: false,
        disabled: false,
      },
    ],
  };
}

function renderWithMessage(initial: OutboundMessage | null = null) {
  return renderHook((message: OutboundMessage | null) => useMatchProgress(message), {
    initialProps: initial,
  });
}

describe("useMatchProgress", () => {
  it("starts empty", () => {
    const { result } = renderWithMessage(null);
    expect(result.current).toEqual(new Map());
  });

  it("stores the latest progress per match", () => {
    const { result, rerender } = renderWithMessage(null);

    act(() => {
      rerender(progress("m1"));
    });

    expect(result.current.get("m1")).toEqual(progress("m1").entries);
  });

  it("keeps separate entries for different matches", () => {
    const { result, rerender } = renderWithMessage(progress("m1"));

    act(() => {
      rerender(progress("m2"));
    });

    expect(result.current.get("m1")).toEqual(progress("m1").entries);
    expect(result.current.get("m2")).toEqual(progress("m2").entries);
  });

  it("updates an existing match entry", () => {
    const { result, rerender } = renderWithMessage(progress("m1"));

    const updated: MatchProgressMessage = {
      ...progress("m1"),
      entries: [{ ...progress("m1").entries[0], progress: 0.5 }],
    };

    act(() => {
      rerender(updated);
    });

    expect(result.current.get("m1")?.[0].progress).toBe(0.5);
  });

  it("ignores unrelated message types", () => {
    const { result, rerender } = renderWithMessage(progress("m1"));

    act(() => {
      rerender({ type: "ping-broadcast", sentAt: "x", text: "x" });
    });

    expect(result.current.get("m1")).toEqual(progress("m1").entries);
  });
});
