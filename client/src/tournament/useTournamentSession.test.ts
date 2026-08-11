import type { OutboundMessage, TournamentShowState, TournamentState } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentSession } from "./useTournamentSession";

describe("useTournamentSession", () => {
  it("stores the atomic snapshot and derives clock offset", () => {
    vi.spyOn(Date, "now").mockReturnValue(48_000);
    const state = { mode: "single-elimination" } as TournamentState;
    const show = { phase: "ready" } as TournamentShowState;
    const { result, rerender } = renderHook(
      (message: OutboundMessage | null) => useTournamentSession(message),
      { initialProps: null as OutboundMessage | null }
    );

    act(() => {
      rerender({
        type: "tournament-state",
        state,
        show,
        serverNowMs: 50_000,
      });
    });

    expect(result.current).toEqual({ tournament: state, show, clockOffsetMs: 2_000 });
    vi.restoreAllMocks();
  });
});
