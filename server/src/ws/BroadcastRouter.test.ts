import type { PingBroadcastMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import { BroadcastRouter } from "./BroadcastRouter";
import type { ClientSource } from "./ClientSource";
import type { ConnectedClient } from "./ConnectedClient";

function createFakeClient(id: string): ConnectedClient {
  return { id, send: vi.fn() };
}

describe("BroadcastRouter", () => {
  it("delivers the message to all other clients but not to the sender", () => {
    const a = createFakeClient("a");
    const b = createFakeClient("b");
    const c = createFakeClient("c");

    const clients: ClientSource = {
      getOthers: (senderId) => [a, b, c].filter((client) => client.id !== senderId),
    };

    const router = new BroadcastRouter(clients);
    const message: PingBroadcastMessage = {
      type: "ping-broadcast",
      sentAt: "2024-01-01T00:00:00.000Z",
      text: "Ping von Admin",
    };

    router.route("a", message);

    expect(a.send).not.toHaveBeenCalled();
    expect(b.send).toHaveBeenCalledWith(message);
    expect(c.send).toHaveBeenCalledWith(message);
  });
});
