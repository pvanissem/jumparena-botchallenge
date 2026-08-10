import { type BotRemoveMessage, type OutboundMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { BotRegistry } from "../BotRegistry";
import type { BotRegistryStore } from "../BotRegistryStore";

export function createBotRemoveHandler(
  registry: BotRegistry,
  store: BotRegistryStore,
  broadcastAll: (message: OutboundMessage) => void
): MessageHandler<BotRemoveMessage> {
  return (_senderId, message) => {
    if (!registry.remove(message.id)) return;
    store.save(registry.list());
    broadcastAll({ type: "bot-removed", id: message.id });
  };
}
