import type { PingBroadcastMessage } from "@arena/shared";
import type { BroadcastRouter } from "../BroadcastRouter";
import type { MessageHandler } from "../MessageDispatcher";

export function createPingBroadcastHandler(
  router: BroadcastRouter
): MessageHandler<PingBroadcastMessage> {
  return (senderId, message) => router.route(senderId, message);
}
