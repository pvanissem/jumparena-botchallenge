import { randomUUID } from "node:crypto";
import { type BotAddMessage, MAX_BOT_SOURCE_BYTES, type OutboundMessage } from "@arena/shared";
import { checkStaticGuard } from "@arena/bot-contract";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { BotRegistry } from "../BotRegistry";
import type { BotRegistryStore } from "../BotRegistryStore";
import { colorForId } from "../colorForId";

export function createBotAddHandler(
  registry: BotRegistry,
  store: BotRegistryStore,
  broadcastAll: (message: OutboundMessage) => void,
  createId: () => string = randomUUID,
  now: () => Date = () => new Date()
): MessageHandler<BotAddMessage> {
  return (_senderId, message) => {
    if (Buffer.byteLength(message.sourceCode, "utf-8") > MAX_BOT_SOURCE_BYTES) {
      console.warn("Bot-Upload abgelehnt: Quelltext zu groß");
      return;
    }

    const guard = checkStaticGuard(message.sourceCode);
    if (!guard.allowed) {
      console.warn(`Bot-Upload abgelehnt: verbotenes Muster ${guard.matchedPattern}`);
      return;
    }

    const id = createId();
    const bot = {
      id,
      name: message.name,
      author: message.author,
      color: message.color ?? colorForId(id),
      sourceCode: message.sourceCode,
      uploadedAt: now().toISOString(),
    };

    registry.add(bot);
    store.save(registry.list());
    broadcastAll({ type: "bot-added", bot });
  };
}
