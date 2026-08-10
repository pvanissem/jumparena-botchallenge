import { describe, expect, it, vi } from "vitest";
import { BotRegistry } from "../BotRegistry";
import type { BotRegistryStore } from "../BotRegistryStore";
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
  it("removes a known bot, persists, and broadcasts the removal", () => {
    const registry = new BotRegistry([sampleBot("b1"), sampleBot("b2")]);
    const store: BotRegistryStore = { save: vi.fn(), load: vi.fn(() => []) };
    const broadcasts: unknown[] = [];
    const broadcastAll = (message: unknown) => broadcasts.push(message);

    const handler = createBotRemoveHandler(registry, store, broadcastAll);
    handler("sender-1", { type: "bot-remove", id: "b1" });

    expect(registry.list()).toEqual([sampleBot("b2")]);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith(registry.list());
    expect(broadcasts).toEqual([{ type: "bot-removed", id: "b1" }]);
  });

  it("does nothing for an unknown id", () => {
    const registry = new BotRegistry([sampleBot("b1")]);
    const store: BotRegistryStore = { save: vi.fn(), load: vi.fn(() => []) };
    const broadcasts: unknown[] = [];
    const broadcastAll = (message: unknown) => broadcasts.push(message);

    const handler = createBotRemoveHandler(registry, store, broadcastAll);
    handler("sender-1", { type: "bot-remove", id: "unknown" });

    expect(registry.list()).toEqual([sampleBot("b1")]);
    expect(store.save).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
  });
});
