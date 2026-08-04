import { describe, expect, it } from "vitest";
import { parseInboundMessage } from "./parseMessage";

describe("parseInboundMessage", () => {
  it("parses a valid ping-broadcast payload", () => {
    const raw = JSON.stringify({
      type: "ping-broadcast",
      sentAt: "2024-01-01T00:00:00.000Z",
      text: "Ping von Admin",
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "ping-broadcast",
      sentAt: "2024-01-01T00:00:00.000Z",
      text: "Ping von Admin",
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseInboundMessage("not-json{")).toBeNull();
  });

  it("returns null for an unknown message type", () => {
    const raw = JSON.stringify({ type: "unknown-type" });
    expect(parseInboundMessage(raw)).toBeNull();
  });

  it("returns null for valid JSON that is not an object", () => {
    expect(parseInboundMessage(JSON.stringify("just a string"))).toBeNull();
  });

  it("parses a valid audio-settings payload", () => {
    const raw = JSON.stringify({ type: "audio-settings", muted: true, volume: 0.4 });

    expect(parseInboundMessage(raw)).toEqual({
      type: "audio-settings",
      muted: true,
      volume: 0.4,
    });
  });
});
