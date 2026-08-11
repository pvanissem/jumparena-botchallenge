import { describe, expect, it, vi } from "vitest";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createTournamentResetHandler } from "./createTournamentResetHandler";

describe("createTournamentResetHandler", () => {
  it("resets only for an admin sender", () => {
    const session = { reset: vi.fn() } as unknown as TournamentSessionService;
    const clients = {
      roleOf: vi.fn((id) => (id === "admin" ? "admin" : "present")),
    } as unknown as ClientRegistry;
    const handler = createTournamentResetHandler(session, clients);

    handler("present", { type: "tournament-reset" });
    handler("admin", { type: "tournament-reset" });

    expect(session.reset).toHaveBeenCalledTimes(1);
  });
});
