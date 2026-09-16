// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";
import { describe, expect, it } from "vitest";

describe("Framework integration", () => {
  it("loads the actual preview config in Node without a TypeScript package loader", async () => {
    const config = await loadConfigFromFile(
      { command: "serve", mode: "development" },
      fileURLToPath(new URL("../vite.config.ts", import.meta.url))
    );
    expect(config?.config.plugins).toBeDefined();
  });
  it("links the navigation package and includes the framework in root builds", async () => {
    const root = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
    const client = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(client.dependencies["@arena/bot-navigation"]).toBe("*");
    expect(root.scripts.build).toContain("npm run build -w @arena/bot-navigation");
    expect(root.scripts["bot:test"]).toBeUndefined();
  });

  it("uses the existing preview and traces without a separate test station", async () => {
    const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
    expect(config).toContain("botTracePlugin()");
    expect(config).not.toContain("botTestPlugin");
    expect(config).not.toContain("BOT_TEST_");
  });
});
