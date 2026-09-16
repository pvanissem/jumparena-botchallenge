// @vitest-environment node
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error JavaScript-ESM-Skript exportiert bewusst ohne Declaration-Datei.
import { resetBot } from "../../scripts/reset-bot.mjs";

describe("resetBot", () => {
  const roots: string[] = [];
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("copies the real template byte-for-byte and removes traces only on explicit reset", async () => {
    const root = await mkdtemp(join(tmpdir(), "reset-bot-"));
    roots.push(root);
    const botDir = join(root, "client/src/bot");
    const traces = join(root, "client/src/bot/runs");
    await mkdir(botDir, { recursive: true });
    await mkdir(traces, { recursive: true });
    const template = await readFile(new URL("../src/bot/current-bot.template.js", import.meta.url));
    await writeFile(join(botDir, "current-bot.template.js"), template);
    await writeFile(join(botDir, "current-bot.js"), "custom");
    await writeFile(join(traces, "old.json"), "{}");
    await writeFile(join(root, "keep.txt"), "keep");

    expect(await readFile(join(botDir, "current-bot.js"), "utf8")).toBe("custom");

    await resetBot(root);

    expect(await readFile(join(botDir, "current-bot.js"))).toEqual(template);
    expect(await readdir(traces)).toEqual([]);
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("keep");
    expect(await readFile(join(botDir, "current-bot.template.js"))).toEqual(template);
    await resetBot(root);
    expect(await readFile(join(botDir, "current-bot.js"))).toEqual(template);
  });

  it("does not erase session data when the template is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "reset-bot-"));
    roots.push(root);
    const botDir = join(root, "client/src/bot");
    await mkdir(join(botDir, "runs"), { recursive: true });
    await writeFile(join(botDir, "current-bot.js"), "custom");
    await writeFile(join(botDir, "runs/keep.json"), "{}");
    await expect(resetBot(root)).rejects.toThrow();
    expect(await readFile(join(botDir, "current-bot.js"), "utf8")).toBe("custom");
    expect(await readFile(join(botDir, "runs/keep.json"), "utf8")).toBe("{}");
  });

  it("reports the explicit bot and trace reset in a temporary station", async () => {
    const root = await mkdtemp(join(tmpdir(), "reset-bot-"));
    roots.push(root);
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, "client/src/bot"), { recursive: true });
    await copyFile(
      new URL("../../scripts/reset-bot.mjs", import.meta.url),
      join(root, "scripts/reset-bot.mjs")
    );
    await writeFile(join(root, "client/src/bot/current-bot.template.js"), "fixture");
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [join(root, "scripts/reset-bot.mjs")],
      { cwd: root }
    );
    expect(stdout).toContain("Bot-Traces wurden gel");
    expect(stdout).not.toContain("Testergebnisse");
    expect(await readFile(join(root, "client/src/bot/current-bot.js"), "utf8")).toBe("fixture");
  });
});
