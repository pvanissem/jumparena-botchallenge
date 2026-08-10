import { describe, expect, it, vi } from "vitest";
import { WebSocketClient, type WebSocketLike } from "./WebSocketClient";

class FakeWebSocket implements WebSocketLike {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.onclose?.();
  }
}

describe("WebSocketClient", () => {
  it("reports 'connecting' immediately after connect() is called", () => {
    const fakeSockets: FakeWebSocket[] = [];
    const client = new WebSocketClient("ws://localhost/test", {
      createSocket: () => {
        const socket = new FakeWebSocket();
        fakeSockets.push(socket);
        return socket;
      },
    });

    const statuses: string[] = [];
    client.onStatusChange((status) => statuses.push(status));

    client.connect();

    expect(statuses).toEqual(["connecting"]);
  });

  it("reports 'connected' once the underlying socket opens", () => {
    let fakeSocket: FakeWebSocket | undefined;
    const client = new WebSocketClient("ws://localhost/test", {
      createSocket: () => {
        fakeSocket = new FakeWebSocket();
        return fakeSocket;
      },
    });

    const statuses: string[] = [];
    client.onStatusChange((status) => statuses.push(status));
    client.connect();
    fakeSocket?.onopen?.();

    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("reports 'disconnected' and schedules a reconnect after the socket closes", () => {
    vi.useFakeTimers();
    const created: FakeWebSocket[] = [];
    const client = new WebSocketClient("ws://localhost/test", {
      createSocket: () => {
        const socket = new FakeWebSocket();
        created.push(socket);
        return socket;
      },
      retryIntervalMs: 1000,
    });

    const statuses: string[] = [];
    client.onStatusChange((status) => statuses.push(status));
    client.connect();
    created[0]?.onopen?.();
    created[0]?.onclose?.();

    expect(statuses).toEqual(["connecting", "connected", "disconnected"]);
    expect(created).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(created).toHaveLength(2);

    vi.useRealTimers();
  });

  it("forwards incoming messages to registered onMessage callbacks", () => {
    let fakeSocket: FakeWebSocket | undefined;
    const client = new WebSocketClient("ws://localhost/test", {
      createSocket: () => {
        fakeSocket = new FakeWebSocket();
        return fakeSocket;
      },
    });

    const received: unknown[] = [];
    client.onMessage((message) => received.push(message));
    client.connect();

    fakeSocket?.onmessage?.({
      data: JSON.stringify({ type: "ping-broadcast", sentAt: "now", text: "hi" }),
    });

    expect(received).toEqual([{ type: "ping-broadcast", sentAt: "now", text: "hi" }]);
  });

  it("does not reconnect after disconnect()", () => {
    vi.useFakeTimers();
    const created: FakeWebSocket[] = [];
    const client = new WebSocketClient("ws://localhost/test", {
      createSocket: () => {
        const socket = new FakeWebSocket();
        created.push(socket);
        return socket;
      },
      retryIntervalMs: 1000,
    });

    client.connect();
    created[0]?.onopen?.();
    client.disconnect();

    expect(created[0]?.closed).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(created).toHaveLength(1);

    vi.useRealTimers();
  });

  it("serializes outgoing messages sent via send()", () => {
    let fakeSocket: FakeWebSocket | undefined;
    const client = new WebSocketClient("ws://localhost/test", {
      createSocket: () => {
        fakeSocket = new FakeWebSocket();
        return fakeSocket;
      },
    });

    client.connect();
    client.send({ type: "ping-broadcast", sentAt: "now", text: "hi" });

    expect(fakeSocket?.sent).toEqual([
      JSON.stringify({ type: "ping-broadcast", sentAt: "now", text: "hi" }),
    ]);
  });
});
