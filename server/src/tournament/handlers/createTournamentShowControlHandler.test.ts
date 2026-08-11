import { describe, expect, it, vi } from "vitest";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createTournamentShowControlHandler } from "./createTournamentShowControlHandler";

describe("createTournamentShowControlHandler", () => {
  it("allows show controls only for admins", () => {
    const session = { control: vi.fn() } as unknown as TournamentSessionService;
    const clients = {
      roleOf: vi.fn((id) => (id === "admin" ? "admin" : null)),
    } as unknown as ClientRegistry;
    const handler = createTournamentShowControlHandler(session, clients);
    const message = { type: "tournament-show-control", action: "start" } as const;

    handler("guest", message);
    handler("admin", message);

    expect(session.control).toHaveBeenCalledTimes(1);
    expect(session.control).toHaveBeenCalledWith("start");
  });
});
