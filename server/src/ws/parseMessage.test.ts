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

  it("parses a valid bot-add payload", () => {
    const raw = JSON.stringify({
      type: "bot-add",
      name: "Racer",
      author: "Max",
      color: "#ff0000",
      sourceCode: "export default {}",
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "bot-add",
      name: "Racer",
      author: "Max",
      color: "#ff0000",
      sourceCode: "export default {}",
    });
  });

  it("parses a valid bot-add payload without optional color", () => {
    const raw = JSON.stringify({
      type: "bot-add",
      name: "Racer",
      author: "Max",
      sourceCode: "export default {}",
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "bot-add",
      name: "Racer",
      author: "Max",
      sourceCode: "export default {}",
    });
  });

  it("returns null for a bot-add payload with missing required fields", () => {
    const raw = JSON.stringify({
      type: "bot-add",
      name: "Racer",
      author: "Max",
    });

    expect(parseInboundMessage(raw)).toBeNull();
  });

  it("parses a valid bot-remove payload", () => {
    const raw = JSON.stringify({ type: "bot-remove", id: "bot-123" });

    expect(parseInboundMessage(raw)).toEqual({ type: "bot-remove", id: "bot-123" });
  });

  it("returns null for a bot-remove payload with missing id", () => {
    expect(parseInboundMessage(JSON.stringify({ type: "bot-remove" }))).toBeNull();
  });

  it("parses a valid tournament-configure payload", () => {
    const raw = JSON.stringify({
      type: "tournament-configure",
      mode: "single-elimination",
      levelId: "level-one",
      botIds: ["b1", "b2"],
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "tournament-configure",
      mode: "single-elimination",
      levelId: "level-one",
      botIds: ["b1", "b2"],
    });
  });

  it("parses a valid tournament-configure payload with livesPerRun", () => {
    const raw = JSON.stringify({
      type: "tournament-configure",
      mode: "single-elimination",
      levelId: "level-one",
      botIds: ["b1", "b2"],
      livesPerRun: 5,
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "tournament-configure",
      mode: "single-elimination",
      levelId: "level-one",
      botIds: ["b1", "b2"],
      livesPerRun: 5,
    });
  });

  it("returns null for tournament-configure with unknown mode", () => {
    const raw = JSON.stringify({
      type: "tournament-configure",
      mode: "round-robin",
      levelId: "level-one",
      botIds: ["b1"],
    });

    expect(parseInboundMessage(raw)).toBeNull();
  });

  it("parses a valid match-start payload", () => {
    const raw = JSON.stringify({ type: "match-start", matchId: "m1" });

    expect(parseInboundMessage(raw)).toEqual({ type: "match-start", matchId: "m1" });
  });

  it("parses a valid tournament-reset payload", () => {
    const raw = JSON.stringify({ type: "tournament-reset" });

    expect(parseInboundMessage(raw)).toEqual({ type: "tournament-reset" });
  });

  it("parses a valid match-result payload", () => {
    const raw = JSON.stringify({
      type: "match-result",
      matchId: "m1",
      result: {
        entries: [
          {
            botId: "b1",
            rank: 1,
            score: 100,
            fruitScore: 50,
            coinsCollected: 5,
            deaths: 0,
            timeElapsedMs: 1000,
            reachedGoal: true,
            disabled: false,
          },
        ],
      },
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "match-result",
      matchId: "m1",
      result: {
        entries: [
          {
            botId: "b1",
            rank: 1,
            score: 100,
            fruitScore: 50,
            coinsCollected: 5,
            deaths: 0,
            timeElapsedMs: 1000,
            reachedGoal: true,
            disabled: false,
          },
        ],
      },
    });
  });

  it("returns null for match-result with incomplete entry", () => {
    const raw = JSON.stringify({
      type: "match-result",
      matchId: "m1",
      result: { entries: [{ botId: "b1" }] },
    });

    expect(parseInboundMessage(raw)).toBeNull();
  });

  it("parses a valid match-progress payload", () => {
    const raw = JSON.stringify({
      type: "match-progress",
      matchId: "m1",
      entries: [
        {
          botId: "b1",
          fruitScore: 10,
          livesRemaining: 2,
          timeElapsedMs: 1000,
          progress: 0.25,
          finished: false,
          didNotFinish: false,
          disabled: false,
        },
      ],
    });

    expect(parseInboundMessage(raw)).toEqual({
      type: "match-progress",
      matchId: "m1",
      entries: [
        {
          botId: "b1",
          fruitScore: 10,
          livesRemaining: 2,
          timeElapsedMs: 1000,
          progress: 0.25,
          finished: false,
          didNotFinish: false,
          disabled: false,
        },
      ],
    });
  });
});
