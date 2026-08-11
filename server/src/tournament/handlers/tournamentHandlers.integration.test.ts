import { describe, expect, it, vi } from "vitest";
import { ClientRegistry } from "../../ws/ClientRegistry";
import { MessageDispatcher } from "../../ws/MessageDispatcher";
import { parseInboundMessage } from "../../ws/parseMessage";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createTournamentConfigureHandler } from "./createTournamentConfigureHandler";
import { createTournamentShowControlHandler } from "./createTournamentShowControlHandler";

describe("tournament handler pipeline", () => {
  it("parses, dispatches and enforces the registered admin role", () => {
    const clients = new ClientRegistry();
    clients.add({ id: "admin", send: vi.fn() });
    clients.add({ id: "present", send: vi.fn() });
    clients.registerRole("admin", "admin");
    clients.registerRole("present", "present");
    const session = { configure: vi.fn(), control: vi.fn() } as unknown as TournamentSessionService;
    const dispatcher = new MessageDispatcher();
    dispatcher.register("tournament-configure", createTournamentConfigureHandler(session, clients));
    dispatcher.register(
      "tournament-show-control",
      createTournamentShowControlHandler(session, clients)
    );
    const configure = parseInboundMessage(
      JSON.stringify({
        type: "tournament-configure",
        mode: "single-elimination",
        stageLevelIds: ["level-one"],
        botIds: ["b1", "b2"],
      })
    );
    const start = parseInboundMessage(
      JSON.stringify({ type: "tournament-show-control", action: "start" })
    );
    if (!configure || !start) throw new Error("Expected valid commands");

    dispatcher.dispatch("present", configure);
    dispatcher.dispatch("admin", configure);
    dispatcher.dispatch("admin", start);

    expect(session.configure).toHaveBeenCalledTimes(1);
    expect(session.control).toHaveBeenCalledWith("start");
  });
});
