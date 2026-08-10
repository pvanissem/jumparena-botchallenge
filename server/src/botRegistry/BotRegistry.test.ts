import { describe, expect, it } from "vitest";
import { BotRegistry } from "./BotRegistry";

function sampleBot(id: string) {
  return {
    id,
    name: "Bot",
    author: "Author",
    color: "#000000",
    sourceCode: "export default {}",
    uploadedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("BotRegistry", () => {
  it("starts empty", () => {
    const registry = new BotRegistry();

    expect(registry.list()).toEqual([]);
  });

  it("adds a bot and returns it in list", () => {
    const registry = new BotRegistry();
    const bot = sampleBot("b1");

    registry.add(bot);

    expect(registry.list()).toEqual([bot]);
  });

  it("keeps initial bots provided to the constructor", () => {
    const bot = sampleBot("b1");

    const registry = new BotRegistry([bot]);

    expect(registry.list()).toEqual([bot]);
  });

  it("removes a known bot and returns true", () => {
    const bot = sampleBot("b1");
    const registry = new BotRegistry([bot]);

    const removed = registry.remove("b1");

    expect(removed).toBe(true);
    expect(registry.list()).toEqual([]);
  });

  it("returns false and keeps state when removing an unknown id", () => {
    const bot = sampleBot("b1");
    const registry = new BotRegistry([bot]);

    const removed = registry.remove("unknown");

    expect(removed).toBe(false);
    expect(registry.list()).toEqual([bot]);
  });
});
