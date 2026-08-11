import type { TournamentConfigureMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createTournamentConfigureHandler } from "./createTournamentConfigureHandler";

const message: TournamentConfigureMessage = {
  type: "tournament-configure",
  mode: "single-elimination",
  stageLevelIds: ["level-one"],
  botIds: ["b1", "b2"],
};

function setup(role: "admin" | "present" | null) {
  const session = { configure: vi.fn() } as unknown as TournamentSessionService;
  const clients = { roleOf: vi.fn(() => role) } as unknown as ClientRegistry;
  return { clients, session };
}

describe("createTournamentConfigureHandler", () => {
  it("lets an admin configure the session", () => {
    const { clients, session } = setup("admin");
    createTournamentConfigureHandler(session, clients)("admin-1", message);
    expect(session.configure).toHaveBeenCalledWith(message);
  });

  it("ignores non-admin senders", () => {
    const { clients, session } = setup("present");
    createTournamentConfigureHandler(session, clients)("present-1", message);
    expect(session.configure).not.toHaveBeenCalled();
  });
});
