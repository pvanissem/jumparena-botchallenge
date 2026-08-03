import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { OutboundMessage } from "@arena/shared";
import { type WebSocket, WebSocketServer } from "ws";
import type { ClientRegistry } from "./ClientRegistry";
import type { ConnectedClient } from "./ConnectedClient";
import type { MessageDispatcher } from "./MessageDispatcher";
import { parseInboundMessage } from "./parseMessage";

/**
 * Owns only the WebSocket connection lifecycle (connect / message / close).
 * Deliberately does NOT decide what happens for a given message type - that
 * responsibility lives in MessageDispatcher/handlers (SRP, Open/Closed).
 */
export class WebSocketGateway {
  private readonly wss: WebSocketServer;

  constructor(
    private readonly registry: ClientRegistry,
    private readonly dispatcher: MessageDispatcher
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (socket) => this.handleConnection(socket));
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit("connection", ws, request);
    });
  }

  private handleConnection(socket: WebSocket): void {
    const client: ConnectedClient = {
      id: randomUUID(),
      send: (message: OutboundMessage) => {
        socket.send(JSON.stringify(message));
      },
    };

    this.registry.add(client);

    socket.on("message", (raw) => {
      const message = parseInboundMessage(raw.toString());
      if (!message) {
        console.warn(`Ignoring invalid message from client ${client.id}`);
        return;
      }
      this.dispatcher.dispatch(client.id, message);
    });

    const cleanup = () => this.registry.remove(client.id);
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  }
}
