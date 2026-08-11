import type { OutboundMessage } from "@arena/shared";

/**
 * Represents a single connected WebSocket client from the server's
 * perspective. Connection metadata stays in ClientRegistry so this transport
 * abstraction remains minimal.
 */
export interface ConnectedClient {
  readonly id: string;
  send(message: OutboundMessage): void;
}
