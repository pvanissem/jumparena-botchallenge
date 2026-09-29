import { describe, expect, it, vi } from "vitest";
import { ClientRegistry } from "../../ws/ClientRegistry";
import { parseInboundMessage } from "../../ws/parseMessage";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createMatchSkipHandler } from "./createMatchSkipHandler";

const message = { type: "match-skip", matchId: "m1", matchAttemptId: "a1" } as const;

describe("admin match skip", () => {
  it("parses only complete match-scoped requests", () => {
    expect(parseInboundMessage(JSON.stringify(message))).toEqual(message);
    for (const invalid of [
      { ...message, matchId: "" },
      { ...message, matchAttemptId: "" },
      { type: "match-skip", matchId: "m1" },
    ]) {
      expect(parseInboundMessage(JSON.stringify(invalid))).toBeNull();
    }
  });

  it("forwards only an admin request for the running attempt to its ready executor", () => {
    const clients = new ClientRegistry();
    const sends = { admin: vi.fn(), executor: vi.fn(), display: vi.fn() };
    for (const [id, send] of Object.entries(sends)) {
      clients.add({ id, send });
      clients.registerRole(id, id === "admin" ? "admin" : "present");
      clients.setPresentReady(id, true);
    }
    const show = {
      phase: "match-running",
      activeMatchId: "m1",
      matchAttemptId: "a1",
      executorClientId: "executor",
    };
    const session = { getSnapshot: () => ({ show }) } as unknown as TournamentSessionService;
    const handler = createMatchSkipHandler(session, clients);
    handler("display", message);
    handler("guest", message);
    handler("admin", { ...message, matchAttemptId: "stale" });
    handler("admin", { ...message, matchId: "old" });
    expect(sends.executor).not.toHaveBeenCalled();
    handler("admin", message);
    expect(sends.executor).toHaveBeenCalledTimes(1);
    expect(sends.executor).toHaveBeenCalledWith(message);
    expect(sends.admin).not.toHaveBeenCalled();
    expect(sends.display).not.toHaveBeenCalled();
    show.phase = "match-result";
    handler("admin", message);
    show.phase = "match-running";
    clients.setPresentReady("executor", false);
    handler("admin", message);
    expect(sends.executor).toHaveBeenCalledTimes(1);
  });
});
