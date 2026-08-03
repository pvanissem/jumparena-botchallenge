import type { InboundMessage } from "@arena/shared";

export type MessageHandler<M extends InboundMessage = InboundMessage> = (
  senderId: string,
  message: M
) => void;

/**
 * Maps message `type` -> handler. New message types are supported by
 * registering a new handler, without modifying this class or the
 * WebSocketGateway (Open/Closed Principle).
 */
export class MessageDispatcher {
  private readonly handlers = new Map<string, MessageHandler>();

  register<T extends InboundMessage["type"]>(
    type: T,
    handler: MessageHandler<Extract<InboundMessage, { type: T }>>
  ): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  dispatch(senderId: string, message: InboundMessage): void {
    const handler = this.handlers.get(message.type);
    handler?.(senderId, message);
  }
}
