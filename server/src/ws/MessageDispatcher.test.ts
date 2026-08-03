import type { PingBroadcastMessage } from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import { MessageDispatcher } from "./MessageDispatcher";

describe("MessageDispatcher", () => {
  it("invokes the handler registered for the matching message type", () => {
    const dispatcher = new MessageDispatcher();
    const handler = vi.fn();
    dispatcher.register("ping-broadcast", handler);

    const message: PingBroadcastMessage = {
      type: "ping-broadcast",
      sentAt: "2024-01-01T00:00:00.000Z",
      text: "Ping von Admin",
    };

    dispatcher.dispatch("sender-1", message);

    expect(handler).toHaveBeenCalledWith("sender-1", message);
  });

  it("does not throw and calls no handler for an unregistered type", () => {
    const dispatcher = new MessageDispatcher();
    const handler = vi.fn();
    dispatcher.register("ping-broadcast", handler);

    expect(() =>
      dispatcher.dispatch("sender-1", {
        type: "some-other-type",
      } as unknown as PingBroadcastMessage)
    ).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
