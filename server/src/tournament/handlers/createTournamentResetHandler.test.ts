import { describe, expect, it, vi } from "vitest";
import type { TournamentService } from "../TournamentService";
import { createTournamentResetHandler } from "./createTournamentResetHandler";

function makeService(): TournamentService {
  return {
    reset: vi.fn(),
  } as unknown as TournamentService;
}

describe("createTournamentResetHandler", () => {
  it("resets the service and broadcasts the cleared state", () => {
    const service = makeService();
    const broadcast = vi.fn();

    createTournamentResetHandler(service, broadcast)("sender", { type: "tournament-reset" });

    expect(service.reset).toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalledTimes(1);
  });
});
