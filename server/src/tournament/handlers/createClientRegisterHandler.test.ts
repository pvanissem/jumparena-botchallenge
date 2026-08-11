import { describe, expect, it, vi } from "vitest";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createClientRegisterHandler } from "./createClientRegisterHandler";

describe("createClientRegisterHandler", () => {
  it("registers the role and acknowledges only the sender", () => {
    const clients = { registerRole: vi.fn() } as unknown as ClientRegistry;
    const session = {
      onPresentAvailabilityChanged: vi.fn(),
    } as unknown as TournamentSessionService;
    const sendToClient = vi.fn();

    createClientRegisterHandler(
      clients,
      session,
      sendToClient
    )("client-1", {
      type: "client-register",
      role: "present",
    });

    expect(clients.registerRole).toHaveBeenCalledWith("client-1", "present");
    expect(sendToClient).toHaveBeenCalledWith("client-1", {
      type: "client-registered",
      clientId: "client-1",
      role: "present",
    });
    expect(session.onPresentAvailabilityChanged).toHaveBeenCalled();
  });
});
