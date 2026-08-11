import type { ArenaClientRole } from "@arena/shared";
import type { ClientSource } from "./ClientSource";
import type { ConnectedClient } from "./ConnectedClient";

/**
 * Tracks connected clients and their connection-scoped operating role.
 */
export class ClientRegistry implements ClientSource {
  private readonly clients = new Map<string, ConnectedClient>();
  private readonly roles = new Map<string, ArenaClientRole>();
  private readonly readyPresentClientIds = new Set<string>();

  add(client: ConnectedClient): void {
    this.clients.set(client.id, client);
  }

  remove(clientId: string): void {
    this.clients.delete(clientId);
    this.roles.delete(clientId);
    this.readyPresentClientIds.delete(clientId);
  }

  registerRole(clientId: string, role: ArenaClientRole): void {
    if (!this.clients.has(clientId)) return;
    this.roles.set(clientId, role);
    if (role !== "present") this.readyPresentClientIds.delete(clientId);
  }

  setPresentReady(clientId: string, ready: boolean): void {
    if (!this.clients.has(clientId) || this.roles.get(clientId) !== "present") return;
    if (ready) this.readyPresentClientIds.add(clientId);
    else this.readyPresentClientIds.delete(clientId);
  }

  roleOf(clientId: string): ArenaClientRole | null {
    return this.roles.get(clientId) ?? null;
  }

  getReadyPresentClients(): ConnectedClient[] {
    return [...this.clients.values()].filter((client) =>
      this.readyPresentClientIds.has(client.id)
    );
  }

  getOthers(senderId: string): ConnectedClient[] {
    return [...this.clients.values()].filter((client) => client.id !== senderId);
  }

  getAll(): ConnectedClient[] {
    return [...this.clients.values()];
  }
}
