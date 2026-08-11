import { describe, expect, it, vi } from "vitest";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { TournamentSessionService } from "../TournamentSessionService";
import { createPresentReadyHandler } from "./createPresentReadyHandler";

describe("createPresentReadyHandler", () => {
  it("updates readiness only for a registered present", () => {
    const clients = {
      roleOf: vi.fn((id) => (id === "present" ? "present" : "admin")),
      setPresentReady: vi.fn(),
    } as unknown as ClientRegistry;
    const session = {
      onPresentAvailabilityChanged: vi.fn(),
    } as unknown as TournamentSessionService;
    const handler = createPresentReadyHandler(clients, session);

    handler("admin", { type: "present-ready", ready: true });
    handler("present", { type: "present-ready", ready: true });

    expect(clients.setPresentReady).toHaveBeenCalledTimes(1);
    expect(clients.setPresentReady).toHaveBeenCalledWith("present", true);
    expect(session.onPresentAvailabilityChanged).toHaveBeenCalledTimes(1);
  });
});
