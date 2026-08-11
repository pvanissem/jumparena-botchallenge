import type { ArenaClientRole, InboundMessage, OutboundMessage } from "@arena/shared";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * Minimal surface of the browser WebSocket API that WebSocketClient needs.
 * Defined as an interface (not the global WebSocket type) so tests can
 * inject a fake implementation without a real network connection.
 */
export interface WebSocketLike {
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface WebSocketClientOptions {
  createSocket?: (url: string) => WebSocketLike;
  retryIntervalMs?: number;
  role?: ArenaClientRole;
}

const DEFAULT_RETRY_INTERVAL_MS = 2000;

function defaultCreateSocket(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike;
}

/**
 * Framework-agnostic WebSocket wrapper: connection lifecycle, a simple fixed
 * reconnect interval (no exponential backoff / retry-limit config - YAGNI/KISS,
 * sufficient for a LAN booth setup), and typed message send/receive.
 */
export class WebSocketClient {
  private readonly createSocket: (url: string) => WebSocketLike;
  private readonly retryIntervalMs: number;
  private readonly role: ArenaClientRole | undefined;
  private socket: WebSocketLike | null = null;
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  private messageListeners: Array<(message: OutboundMessage) => void> = [];
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private explicitlyDisconnected = false;

  constructor(
    private readonly url: string,
    options: WebSocketClientOptions = {}
  ) {
    this.createSocket = options.createSocket ?? defaultCreateSocket;
    this.retryIntervalMs = options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
    this.role = options.role;
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter((listener) => listener !== callback);
    };
  }

  onMessage(callback: (message: OutboundMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((listener) => listener !== callback);
    };
  }

  connect(): void {
    this.explicitlyDisconnected = false;
    this.emitStatus("connecting");
    const socket = this.createSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.emitStatus("connected");
      if (this.role) socket.send(JSON.stringify({ type: "client-register", role: this.role }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as OutboundMessage;
      for (const listener of this.messageListeners) {
        listener(message);
      }
    };

    socket.onclose = () => {
      this.emitStatus("disconnected");
      if (this.explicitlyDisconnected) return;
      this.reconnectTimeout = setTimeout(() => this.connect(), this.retryIntervalMs);
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  disconnect(): void {
    this.explicitlyDisconnected = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  send(message: InboundMessage): void {
    this.socket?.send(JSON.stringify(message));
  }

  private emitStatus(status: ConnectionStatus): void {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
