import { describe, expect, it } from "vitest";
import { isAudioSettingsMessage, isPingBroadcastMessage } from "./messages";

describe("isPingBroadcastMessage", () => {
  it("returns true for a valid ping-broadcast payload", () => {
    const candidate = {
      type: "ping-broadcast",
      sentAt: "2024-01-01T00:00:00.000Z",
      text: "Ping von Admin",
    };

    expect(isPingBroadcastMessage(candidate)).toBe(true);
  });

  it("returns false when type does not match", () => {
    expect(isPingBroadcastMessage({ type: "something-else", sentAt: "x", text: "x" })).toBe(false);
  });

  it("returns false when required fields are missing", () => {
    expect(isPingBroadcastMessage({ type: "ping-broadcast" })).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isPingBroadcastMessage(null)).toBe(false);
    expect(isPingBroadcastMessage("ping-broadcast")).toBe(false);
    expect(isPingBroadcastMessage(undefined)).toBe(false);
  });
});

describe("isAudioSettingsMessage", () => {
  it("returns true for a valid audio-settings payload", () => {
    const candidate = { type: "audio-settings", muted: false, volume: 0.6 };
    expect(isAudioSettingsMessage(candidate)).toBe(true);
  });

  it("returns false when type does not match", () => {
    expect(isAudioSettingsMessage({ type: "something-else", muted: false, volume: 0.6 })).toBe(
      false
    );
  });

  it("returns false when required fields are missing", () => {
    expect(isAudioSettingsMessage({ type: "audio-settings" })).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isAudioSettingsMessage(null)).toBe(false);
    expect(isAudioSettingsMessage("audio-settings")).toBe(false);
    expect(isAudioSettingsMessage(undefined)).toBe(false);
  });
});
