import type { OutboundMessage, TournamentConfigureMessage, TournamentState } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { TournamentService } from "../TournamentService";
import { createTournamentConfigureHandler } from "./createTournamentConfigureHandler";

function makeService(state: TournamentState | null): TournamentService {
  return {
    getState: () => state,
    configure: vi.fn(() => state),
  } as unknown as TournamentService;
}

describe("createTournamentConfigureHandler", () => {
  const message: TournamentConfigureMessage = {
    type: "tournament-configure",
    mode: "single-elimination",
    levelId: "level-one",
    livesPerRun: 3,
    botIds: ["b1", "b2"],
  };

  it("calls configure and broadcasts on success", () => {
    const state: TournamentState = {
      mode: "single-elimination",
      levelId: "level-one",
      livesPerRun: 3,
      rounds: [],
      status: "idle",
      championBotId: null,
    };
    const service = makeService(state);
    const routed: OutboundMessage[] = [];
    const broadcastAll = (message: OutboundMessage) => routed.push(message);

    const handler = createTournamentConfigureHandler(service, () =>
      broadcastAll({ type: "tournament-state", state: service.getState() })
    );
    handler("sender", message);

    expect(service.configure).toHaveBeenCalledWith(message);
    expect(routed).toEqual([{ type: "tournament-state", state }]);
  });

  it("does not broadcast when configure returns null", () => {
    const service = makeService(null);
    const routed: OutboundMessage[] = [];
    const broadcastAll = (message: OutboundMessage) => routed.push(message);

    const handler = createTournamentConfigureHandler(service, () =>
      broadcastAll({ type: "tournament-state", state: service.getState() })
    );
    handler("sender", message);

    expect(service.configure).toHaveBeenCalledWith(message);
    expect(routed).toEqual([]);
  });
});
