import type { OutboundMessage, TournamentShowState, TournamentState } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentSession } from "./useTournamentSession";

describe("useTournamentSession", () => {
  it("stores the atomic snapshot and derives clock offset", () => {
    vi.spyOn(Date, "now").mockReturnValue(48_000);
    const state = { mode: "single-elimination" } as TournamentState;
    const show = { phase: "ready" } as TournamentShowState;
    const listeners = new Set<(message: OutboundMessage) => void>();
    const subscribe = (listener: (message: OutboundMessage) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };
    const { result } = renderHook(() => useTournamentSession(subscribe));

    act(() => {
      const message: OutboundMessage = {
        type: "tournament-state",
        state,
        show,
        serverNowMs: 50_000,
      };
      for (const listener of listeners) listener(message);
    });

    expect(result.current).toEqual({ tournament: state, show, clockOffsetMs: 2_000 });
    vi.restoreAllMocks();
  });
});
