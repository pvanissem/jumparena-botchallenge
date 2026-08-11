import type { MatchProgressMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createMatchProgressHandler } from "./createMatchProgressHandler";

const message: MatchProgressMessage = {
  type: "match-progress",
  matchId: "match-1",
  matchAttemptId: "attempt-1",
  entries: [],
};

describe("createMatchProgressHandler", () => {
  it("routes only progress accepted by the current lease", () => {
    const session = { acceptProgress: vi.fn(() => true) } as unknown as TournamentSessionService;
    const routeToAll = vi.fn();
    createMatchProgressHandler(session, routeToAll)("executor", message);
    expect(routeToAll).toHaveBeenCalledWith(message);
  });

  it("drops stale progress", () => {
    const session = { acceptProgress: vi.fn(() => false) } as unknown as TournamentSessionService;
    const routeToAll = vi.fn();
    createMatchProgressHandler(session, routeToAll)("stale", message);
    expect(routeToAll).not.toHaveBeenCalled();
  });
});
