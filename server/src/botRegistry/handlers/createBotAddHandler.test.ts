import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotRegistry } from "../BotRegistry";
import type { BotRegistryStore } from "../BotRegistryStore";
import { createBotAddHandler } from "./createBotAddHandler";

function createFakes() {
  const registry = new BotRegistry();
  const store: BotRegistryStore = {
    save: vi.fn(),
    load: vi.fn(() => []),
  };
  const broadcasts: unknown[] = [];
  const broadcastAll = (message: unknown) => broadcasts.push(message);
  return { registry, store, broadcasts, broadcastAll };
}

const VALID_SOURCE = "export default { apiVersion: 1, decide() { return []; } };";

const GUARD_VIOLATING_SOURCE = "fetch('https://example.com');";

const OVERSIZED_SOURCE = "x".repeat(200_001);

describe("createBotAddHandler", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a valid bot, persists, and broadcasts it including server-assigned fields", () => {
    const { registry, store, broadcasts, broadcastAll } = createFakes();
    const createId = () => "id-1";
    const now = () => new Date("2024-06-15T12:00:00.000Z");

    const handler = createBotAddHandler(registry, store, broadcastAll, createId, now);
    handler("sender-1", {
      type: "bot-add",
      name: "Racer",
      author: "Max",
      sourceCode: VALID_SOURCE,
    });

    expect(registry.list()).toEqual([
      {
        id: "id-1",
        name: "Racer",
        author: "Max",
        color: expect.stringMatching(/^#[0-9a-f]{6}$/), // fallback color from id
        sourceCode: VALID_SOURCE,
        uploadedAt: "2024-06-15T12:00:00.000Z",
      },
    ]);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith(registry.list());
    expect(broadcasts).toEqual([
      {
        type: "bot-added",
        bot: registry.list()[0],
      },
    ]);
  });

  it("keeps the color provided by the client", () => {
    const { registry, store, broadcasts, broadcastAll } = createFakes();
    const handler = createBotAddHandler(registry, store, broadcastAll);

    handler("sender-1", {
      type: "bot-add",
      name: "Racer",
      author: "Max",
      color: "#00ff00",
      sourceCode: VALID_SOURCE,
    });

    expect(registry.list()[0].color).toBe("#00ff00");
    const broadcastBot = (broadcasts[0] as { bot: { color: string } }).bot;
    expect(broadcastBot.color).toBe("#00ff00");
  });

  it("does nothing for source code that violates the static guard", () => {
    const { registry, store, broadcasts, broadcastAll } = createFakes();
    const handler = createBotAddHandler(registry, store, broadcastAll);

    handler("sender-1", {
      type: "bot-add",
      name: "Bad",
      author: "X",
      sourceCode: GUARD_VIOLATING_SOURCE,
    });

    expect(registry.list()).toEqual([]);
    expect(store.save).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("does nothing when source code exceeds the size limit", () => {
    const { registry, store, broadcasts, broadcastAll } = createFakes();
    const handler = createBotAddHandler(registry, store, broadcastAll);

    handler("sender-1", {
      type: "bot-add",
      name: "Big",
      author: "X",
      sourceCode: OVERSIZED_SOURCE,
    });

    expect(registry.list()).toEqual([]);
    expect(store.save).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});
