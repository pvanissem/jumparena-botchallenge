// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error JavaScript-ESM-Skript exportiert bewusst ohne Declaration-Datei.
import { resetBot } from "../../scripts/reset-bot.mjs";

describe("resetBot", () => {
  it("copies the template and removes only bot trace files", async () => {
    const root = await mkdtemp(join(tmpdir(), "reset-bot-"));
    const botDir = join(root, "client/src/bot");
    const traces = join(root, "client/src/bot/runs");
    await mkdir(botDir, { recursive: true });
    await mkdir(traces, { recursive: true });
    await writeFile(join(botDir, "current-bot.template.js"), "template");
    await writeFile(join(botDir, "current-bot.js"), "custom");
    await writeFile(join(traces, "old.json"), "{}");
    await writeFile(join(root, "keep.txt"), "keep");

    await resetBot(root);

    expect(await readFile(join(botDir, "current-bot.js"), "utf8")).toBe("template");
    expect(await readdir(traces)).toEqual([]);
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("keep");
  });
});
