import type { OutboundMessage } from "@arena/shared";
import type { ClientSource } from "./ClientSource";

/**
 * Decides only WHO receives a message (broadcast to everyone except the
 * sender). Depends on the narrow ClientSource abstraction, not the concrete
 * ClientRegistry (Dependency Inversion Principle).
 */
export class BroadcastRouter {
  constructor(private readonly clients: ClientSource) {}

  route(senderId: string, message: OutboundMessage): void {
    for (const client of this.clients.getOthers(senderId)) {
      client.send(message);
    }
  }

  routeToAll(message: OutboundMessage): void {
    for (const client of this.clients.getAll()) {
      client.send(message);
    }
  }
}
