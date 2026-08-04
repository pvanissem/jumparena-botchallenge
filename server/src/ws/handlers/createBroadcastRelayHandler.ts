import type { InboundMessage } from "@arena/shared";
import type { BroadcastRouter } from "../BroadcastRouter";
import type { MessageHandler } from "../MessageDispatcher";

/**
 * Generic relay handler: forwards any inbound message type to all other
 * connected clients via `BroadcastRouter`, without type-specific logic (used
 * for both `ping-broadcast` and `audio-settings`, see
 * `.features/game-audio/design.md`, Abschnitt "Server-Wiring").
 */
export function createBroadcastRelayHandler<T extends InboundMessage>(
  router: BroadcastRouter
): MessageHandler<T> {
  return (senderId, message) => router.route(senderId, message);
}
