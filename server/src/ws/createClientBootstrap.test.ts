import type { TournamentShowState, TournamentState } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import { createClientBootstrap } from "./createClientBootstrap";

describe("createClientBootstrap", () => {
  it("sends registry, latest audio and atomic tournament session to a new client", () => {
    const send = vi.fn();
    const state = { mode: "single-elimination" } as TournamentState;
    const show = { phase: "ready" } as TournamentShowState;
    const bootstrap = createClientBootstrap({
      listBots: () => [],
      getAudioSettings: () => ({ type: "audio-settings", muted: true, volume: 0.4 }),
      getTournamentSession: () => ({ state, show }),
      now: () => 1_234,
    });

    bootstrap({ id: "client-1", send });

    expect(send.mock.calls.map(([message]) => message)).toEqual([
      { type: "bot-registry-snapshot", bots: [] },
      { type: "audio-settings", muted: true, volume: 0.4 },
      { type: "tournament-state", state, show, serverNowMs: 1_234 },
    ]);
  });
});
