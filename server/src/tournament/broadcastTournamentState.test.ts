import type { OutboundMessage, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { createTournamentStateBroadcaster } from "./broadcastTournamentState";
import type { TournamentService } from "./TournamentService";

function makeService(state: TournamentState | null): TournamentService {
  return {
    getState: () => state,
  } as unknown as TournamentService;
}

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

describe("createTournamentStateBroadcaster", () => {
  it("broadcasts the current tournament state to all clients", () => {
    const captured: OutboundMessage[] = [];
    const broadcast = (message: OutboundMessage) => captured.push(message);
    const service = makeService(state());

    createTournamentStateBroadcaster(service, broadcast)();

    expect(captured).toEqual([{ type: "tournament-state", state: state() }]);
  });

  it("broadcasts null after a reset", () => {
    const captured: OutboundMessage[] = [];
    const broadcast = (message: OutboundMessage) => captured.push(message);
    const service = makeService(null);

    createTournamentStateBroadcaster(service, broadcast)();

    expect(captured).toEqual([{ type: "tournament-state", state: null }]);
  });
});
