import type { MatchResultMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createMatchResultHandler } from "./createMatchResultHandler";

describe("createMatchResultHandler", () => {
  it("passes sender and result to the session lease validator", () => {
    const session = { acceptResult: vi.fn() } as unknown as TournamentSessionService;
    const message = {
      type: "match-result",
      matchId: "match-1",
      matchAttemptId: "attempt-1",
      result: { entries: [] },
    } satisfies MatchResultMessage;

    createMatchResultHandler(session)("present-1", message);

    expect(session.acceptResult).toHaveBeenCalledWith("present-1", message);
  });
});
