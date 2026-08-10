import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JsonFileBotRegistryStore } from "./JsonFileBotRegistryStore";

function sampleBots() {
  return [
    {
      id: "b1",
      name: "Bot One",
      author: "A",
      color: "#111111",
      sourceCode: "export default {}",
      uploadedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "b2",
      name: "Bot Two",
      author: "B",
      color: "#222222",
      sourceCode: "export default {}",
      uploadedAt: "2024-01-02T00:00:00.000Z",
    },
  ];
}

describe("JsonFileBotRegistryStore", () => {
  let tempDir: string;
  let storeFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "bot-registry-"));
    storeFile = join(tempDir, "bot-registry.json");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("round-trips bots through save and load", () => {
    const store = new JsonFileBotRegistryStore(storeFile);
    const bots = sampleBots();

    store.save(bots);
    const loaded = store.load();

    expect(loaded).toEqual(bots);
  });

  it("returns an empty array when the file does not exist", () => {
    const store = new JsonFileBotRegistryStore(storeFile);

    const loaded = store.load();

    expect(loaded).toEqual([]);
  });

  it("returns an empty array and warns when the file contains invalid JSON", () => {
    writeFileSync(storeFile, "not-json");
    const store = new JsonFileBotRegistryStore(storeFile);

    const loaded = store.load();

    expect(loaded).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not throw when the parent directory cannot be created", () => {
    // Create a file where the store expects a directory - mkdirSync must fail.
    const blockedDir = join(tempDir, "blocked");
    writeFileSync(blockedDir, "i am a file");
    const store = new JsonFileBotRegistryStore(join(blockedDir, "registry.json"));

    expect(() => store.save(sampleBots())).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });
});
