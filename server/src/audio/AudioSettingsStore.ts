import type { AudioSettingsMessage } from "@arena/shared";

const DEFAULT_AUDIO_SETTINGS: AudioSettingsMessage = {
  type: "audio-settings",
  muted: false,
  volume: 0.6,
};

export class AudioSettingsStore {
  private current: AudioSettingsMessage = DEFAULT_AUDIO_SETTINGS;

  get(): AudioSettingsMessage {
    return this.current;
  }

  set(message: AudioSettingsMessage): void {
    this.current = message;
  }
}
