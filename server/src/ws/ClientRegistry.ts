import type { ClientSource } from "./ClientSource";
import type { ConnectedClient } from "./ConnectedClient";

/**
 * Tracks connected clients. Sole responsibility: know "who is connected"
 * (SRP) - no routing decisions, no role concept (see design.md YAGNI note).
 */
export class ClientRegistry implements ClientSource {
  private readonly clients = new Map<string, ConnectedClient>();

  add(client: ConnectedClient): void {
    this.clients.set(client.id, client);
  }

  remove(clientId: string): void {
    this.clients.delete(clientId);
  }

  getOthers(senderId: string): ConnectedClient[] {
    return [...this.clients.values()].filter((client) => client.id !== senderId);
  }
}
