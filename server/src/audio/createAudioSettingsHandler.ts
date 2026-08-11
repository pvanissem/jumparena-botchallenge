import type { AudioSettingsMessage } from "@arena/shared";
import type { MessageHandler } from "../ws/MessageDispatcher";
import type { AudioSettingsStore } from "./AudioSettingsStore";

export function createAudioSettingsHandler(
  store: AudioSettingsStore,
  relay: (senderId: string, message: AudioSettingsMessage) => void
): MessageHandler<AudioSettingsMessage> {
  return (senderId, message) => {
    store.set(message);
    relay(senderId, message);
  };
}
