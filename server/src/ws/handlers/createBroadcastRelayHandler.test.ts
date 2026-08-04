import type { PingBroadcastMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import type { BroadcastRouter } from "../BroadcastRouter";
import { createBroadcastRelayHandler } from "./createBroadcastRelayHandler";

describe("createBroadcastRelayHandler", () => {
  it("delegates to the router with the sender id and message", () => {
    const router = { route: vi.fn() } as unknown as BroadcastRouter;
    const handler = createBroadcastRelayHandler<PingBroadcastMessage>(router);

    const message: PingBroadcastMessage = {
      type: "ping-broadcast",
      sentAt: "2024-01-01T00:00:00.000Z",
      text: "Ping von Admin",
    };

    handler("sender-1", message);

    expect(router.route).toHaveBeenCalledWith("sender-1", message);
  });
});
