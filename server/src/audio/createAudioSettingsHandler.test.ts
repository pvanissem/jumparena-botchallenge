import { describe, expect, it, vi } from "vitest";
import { AudioSettingsStore } from "./AudioSettingsStore";
import { createAudioSettingsHandler } from "./createAudioSettingsHandler";

describe("createAudioSettingsHandler", () => {
  it("stores and relays the latest setting", () => {
    const store = new AudioSettingsStore();
    const relay = vi.fn();
    const message = { type: "audio-settings", muted: true, volume: 0.4 } as const;

    createAudioSettingsHandler(store, relay)("admin", message);

    expect(store.get()).toEqual(message);
    expect(relay).toHaveBeenCalledWith("admin", message);
  });
});
