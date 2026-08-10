import type { ConnectedClient } from "./ConnectedClient";

/**
 * Narrow abstraction consumed by routing logic (e.g. BroadcastRouter).
 * Keeps consumers decoupled from the concrete ClientRegistry implementation
 * (Dependency Inversion / Interface Segregation).
 */
export interface ClientSource {
  getOthers(senderId: string): ConnectedClient[];
  getAll(): ConnectedClient[];
}
