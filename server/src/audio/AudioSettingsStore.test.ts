import { describe, expect, it } from "vitest";
import { AudioSettingsStore } from "./AudioSettingsStore";

describe("AudioSettingsStore", () => {
  it("starts with the shared client default and keeps the latest setting", () => {
    const store = new AudioSettingsStore();
    expect(store.get()).toEqual({ type: "audio-settings", muted: false, volume: 0.6 });

    store.set({ type: "audio-settings", muted: true, volume: 0.25 });

    expect(store.get()).toEqual({ type: "audio-settings", muted: true, volume: 0.25 });
  });
});
