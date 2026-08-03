import type { OutboundMessage } from "@arena/shared";

/**
 * Represents a single connected WebSocket client from the server's
 * perspective. Deliberately minimal: no role, no metadata beyond an id -
 * nothing here is needed by any current requirement (YAGNI).
 */
export interface ConnectedClient {
  readonly id: string;
  send(message: OutboundMessage): void;
}
