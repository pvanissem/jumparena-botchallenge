import type { RawData } from "ws";
import { describe, expect, it, vi } from "vitest";
import { ClientRegistry } from "./ClientRegistry";
import type { ConnectedClient } from "./ConnectedClient";
import type { MessageDispatcher } from "./MessageDispatcher";
import { WebSocketGateway } from "./WebSocketGateway";

class FakeSocket {
  private readonly listeners = new Map<string, Array<(data?: RawData) => void>>();

  send = vi.fn();

  on(event: string, listener: (data?: RawData) => void): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

describe("WebSocketGateway", () => {
  it("notifies disconnect exactly once when close is followed by error", () => {
    const registry = new ClientRegistry();
    const dispatcher = { dispatch: vi.fn() } as unknown as MessageDispatcher;
    const onConnected = vi.fn<(client: ConnectedClient) => void>();
    const onDisconnected = vi.fn<(clientId: string) => void>();
    const gateway = new WebSocketGateway(
      registry,
      dispatcher,
      onConnected,
      onDisconnected
    );
    const socket = new FakeSocket();
    const connect = (
      gateway as unknown as { handleConnection(socket: FakeSocket): void }
    ).handleConnection.bind(gateway);

    connect(socket);
    const clientId = onConnected.mock.calls[0][0].id;
    socket.emit("close");
    socket.emit("error");

    expect(onDisconnected).toHaveBeenCalledTimes(1);
    expect(onDisconnected).toHaveBeenCalledWith(clientId);
    expect(registry.getAll()).toEqual([]);
  });
});
