import type { TournamentShowState, TournamentState } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import { createTournamentSessionBroadcaster } from "./broadcastTournamentSession";

describe("createTournamentSessionBroadcaster", () => {
  it("broadcasts tournament and show atomically with server time", () => {
    const send = vi.fn();
    const broadcast = createTournamentSessionBroadcaster(send);
    const state = { mode: "single-elimination" } as TournamentState;
    const show = { phase: "ready" } as TournamentShowState;

    broadcast({ state, show }, 1_234);

    expect(send).toHaveBeenCalledWith({
      type: "tournament-state",
      state,
      show,
      serverNowMs: 1_234,
    });
  });
});
