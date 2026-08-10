import type { MatchStartMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { TournamentService } from "../TournamentService";
import { createMatchStartHandler } from "./createMatchStartHandler";

function makeService(startResult: boolean): TournamentService {
  return {
    startMatch: vi.fn(() => startResult),
  } as unknown as TournamentService;
}

describe("createMatchStartHandler", () => {
  const message: MatchStartMessage = { type: "match-start", matchId: "m1" };

  it("calls startMatch and broadcasts on success", () => {
    const service = makeService(true);
    const broadcast = vi.fn();

    createMatchStartHandler(service, broadcast)("sender", message);

    expect(service.startMatch).toHaveBeenCalledWith("m1");
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("does not broadcast when startMatch returns false", () => {
    const service = makeService(false);
    const broadcast = vi.fn();

    createMatchStartHandler(service, broadcast)("sender", message);

    expect(service.startMatch).toHaveBeenCalledWith("m1");
    expect(broadcast).not.toHaveBeenCalled();
  });
});
