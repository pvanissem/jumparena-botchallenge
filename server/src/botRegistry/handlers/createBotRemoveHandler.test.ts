import { describe, expect, it } from "vitest";
import { BotRegistry } from "../BotRegistry";
import { createBotRemoveHandler } from "./createBotRemoveHandler";

function sampleBot(id: string) {
  return {
    id,
    name: "Bot",
    author: "A",
    color: "#000000",
    sourceCode: "export default {}",
    uploadedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("createBotRemoveHandler", () => {
  it("removes a known bot in memory and broadcasts without persisting", () => {
    const registry = new BotRegistry([sampleBot("b1"), sampleBot("b2")]);
    const broadcasts: unknown[] = [];
    const broadcastAll = (message: unknown) => broadcasts.push(message);

    const handler = createBotRemoveHandler(registry, broadcastAll);
    handler("sender-1", { type: "bot-remove", id: "b1" });

    expect(registry.list()).toEqual([sampleBot("b2")]);
    expect(broadcasts).toEqual([{ type: "bot-removed", id: "b1" }]);
  });

  it("does nothing for an unknown id", () => {
    const registry = new BotRegistry([sampleBot("b1")]);
    const broadcasts: unknown[] = [];
    const broadcastAll = (message: unknown) => broadcasts.push(message);

    const handler = createBotRemoveHandler(registry, broadcastAll);
    handler("sender-1", { type: "bot-remove", id: "unknown" });

    expect(registry.list()).toEqual([sampleBot("b1")]);
    expect(broadcasts).toEqual([]);
  });
});
