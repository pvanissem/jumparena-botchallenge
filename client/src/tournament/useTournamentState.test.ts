import type { OutboundMessage, TournamentState } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTournamentState } from "./useTournamentState";

function state(): TournamentState {
  return {
    mode: "single-elimination",
    levelId: "level-one",
    livesPerRun: 3,
    rounds: [],
    status: "idle",
    championBotId: null,
  };
}

function renderWithMessage(initial: OutboundMessage | null = null) {
  return renderHook((message: OutboundMessage | null) => useTournamentState(message), {
    initialProps: initial,
  });
}

describe("useTournamentState", () => {
  it("starts without a tournament", () => {
    const { result } = renderWithMessage(null);
    expect(result.current).toBeNull();
  });

  it("sets the tournament state on tournament-state message", () => {
    const { result, rerender } = renderWithMessage(null);

    act(() => {
      rerender({ type: "tournament-state", state: state() });
    });

    expect(result.current).toEqual(state());
  });

  it("clears the state when state is null", () => {
    const { result, rerender } = renderWithMessage({ type: "tournament-state", state: state() });

    act(() => {
      rerender({ type: "tournament-state", state: null });
    });

    expect(result.current).toBeNull();
  });

  it("ignores unrelated message types", () => {
    const { result, rerender } = renderWithMessage({ type: "tournament-state", state: state() });

    act(() => {
      rerender({ type: "ping-broadcast", sentAt: "x", text: "x" });
    });

    expect(result.current).toEqual(state());
  });
});
