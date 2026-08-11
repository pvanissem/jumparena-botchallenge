import type { BotRemoveMessage, OutboundMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { BotRegistry } from "../BotRegistry";

export function createBotRemoveHandler(
  registry: BotRegistry,
  broadcastAll: (message: OutboundMessage) => void
): MessageHandler<BotRemoveMessage> {
  return (_senderId, message) => {
    if (!registry.remove(message.id)) return;
    broadcastAll({ type: "bot-removed", id: message.id });
  };
}
