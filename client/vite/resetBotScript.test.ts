// @vitest-environment node
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JavaScript-ESM-Skript exportiert bewusst ohne Declaration-Datei.
import { resetBot } from "../../scripts/reset-bot.mjs";

describe("resetBot", () => {
  const roots: string[] = [];
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function station(source?: string) {
    const root = await mkdtemp(join(tmpdir(), "reset-bot-"));
    roots.push(root);
    await mkdir(join(root, "client/src/bot/runs"), { recursive: true });
    await writeFile(join(root, "client/src/bot/current-bot.template.js"), "template");
    if (source !== undefined) await writeFile(join(root, "client/src/bot/current-bot.js"), source);
    return root;
  }

  async function git(root: string, ...args: string[]) {
    return promisify(execFile)("git", ["-C", root, ...args]);
  }

  async function repository() {
    const root = await station("old bot");
    await writeFile(join(root, ".gitignore"), "/bots/\nclient/src/bot/runs/\n");
    await writeFile(join(root, "framework.js"), "original");
    await git(root, "init");
    await git(root, "add", ".");
    await git(
      root,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "fixture"
    );
    return root;
  }

  it("archives exact bytes with metadata and never overwrites a same-time archive", async () => {
    const source =
      '// author: "wrong"\nexport default { author: "Anna", name: "Flitzer", decide() {} };\n';
    const root = await station(source);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-18T12:34:56.789Z"));
    await resetBot(root);
    const first = "Anna-Flitzer-2026-09-18T12-34-56-789Z.js";
    expect(await readFile(join(root, "bots", first), "utf8")).toBe(source);
    const secondSource = source.replace("decide() {}", "decide() { return []; }");
    await writeFile(join(root, "client/src/bot/current-bot.js"), secondSource);
    await resetBot(root);
    const files = await readdir(join(root, "bots"));
    expect(files).toHaveLength(2);
    expect(await readFile(join(root, "bots", first), "utf8")).toBe(source);
    const secondFile = files.find((file) => file !== first);
    if (!secondFile) throw new Error("Second archive missing");
    expect(await readFile(join(root, "bots", secondFile), "utf8")).toBe(secondSource);
  });

  it.each([
    ["broken javascript {", "unbekannt-unbenannt-"],
    [
      'throw new Error("must never execute"); export default { author: "../Anna", name: "a/b:c" };',
      "Anna-a-b-c-",
    ],
    ['export default { author: (() => { throw new Error(); })(), name: "Bot" };', "unbekannt-Bot-"],
  ])("archives unsafe or incomplete source without executing it: %s", async (source, prefix) => {
    const root = await station(source);
    await resetBot(root);
    const files = await readdir(join(root, "bots"));
    expect(files).toHaveLength(1);
    expect(files[0].startsWith(prefix)).toBe(true);
    expect(await readFile(join(root, "bots", files[0]), "utf8")).toBe(source);
  });

  it("preserves bot and traces if archiving fails", async () => {
    const root = await station("valuable bot");
    await writeFile(join(root, "bots"), "not a directory");
    await writeFile(join(root, "client/src/bot/runs/keep.json"), "trace");
    await expect(resetBot(root)).rejects.toThrow();
    expect(await readFile(join(root, "client/src/bot/current-bot.js"), "utf8")).toBe(
      "valuable bot"
    );
    expect(await readFile(join(root, "client/src/bot/runs/keep.json"), "utf8")).toBe("trace");
  });

  it("initializes a missing bot without an archive and clears old traces", async () => {
    const root = await station();
    await writeFile(join(root, "client/src/bot/runs/old.json"), "trace");
    await resetBot(root);
    expect(await readFile(join(root, "client/src/bot/current-bot.js"), "utf8")).toBe("template");
    expect(await readdir(join(root, "client/src/bot/runs"))).toEqual([]);
    expect(await readdir(root)).not.toContain("bots");
  });

  it("warns about unstaged framework edits and preserves them", async () => {
    const root = await repository();
    await writeFile(join(root, "framework.js"), "unstaged change");
    await resetBot(root);
    expect(vi.mocked(console.warn).mock.calls.flat().join("\n")).toContain("framework.js");
    expect(await readFile(join(root, "framework.js"), "utf8")).toBe("unstaged change");
  });

  it("warns about staged, deleted and untracked files without reverting them", async () => {
    const root = await repository();
    await writeFile(join(root, "framework.js"), "changed");
    await git(root, "add", "framework.js");
    await rm(join(root, ".gitignore"));
    await writeFile(join(root, "new file.js"), "new");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await resetBot(root);
    const output = warn.mock.calls.flat().join("\n");
    expect(output).toContain("WARNUNG");
    expect(output).toContain("framework.js");
    expect(output).toContain(".gitignore");
    expect(output).toContain("new file.js");
    expect(await readFile(join(root, "framework.js"), "utf8")).toBe("changed");
    expect(await readFile(join(root, "new file.js"), "utf8")).toBe("new");
  });

  it("does not warn for a clean repository or changes only to the active bot", async () => {
    const root = await repository();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await resetBot(root);
    await resetBot(root);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns if a tracked framework file was renamed to current-bot.js", async () => {
    const root = await repository();
    await git(root, "mv", "-f", "framework.js", "client/src/bot/current-bot.js");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await resetBot(root);
    expect(warn.mock.calls.flat().join("\n")).toContain("framework.js");
  });

  it("still archives but warns when the git check is unavailable", async () => {
    const root = await station("valuable bot");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await resetBot(root);
    expect(warn.mock.calls.flat().join("\n")).toContain("Git-Status");
    expect(await readdir(join(root, "bots"))).toHaveLength(1);
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
    await symlink(
      new URL("../../node_modules", import.meta.url),
      join(root, "node_modules"),
      "dir"
    );
    await mkdir(join(root, "client/src/bot"), { recursive: true });
    await copyFile(
      new URL("../../scripts/reset-bot.mjs", import.meta.url),
      join(root, "scripts/reset-bot.mjs")
    );
    await writeFile(join(root, "client/src/bot/current-bot.template.js"), "fixture");
    await writeFile(
      join(root, "client/src/bot/current-bot.js"),
      'export default { author: "Anna", name: "Bot" };'
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [join(root, "scripts/reset-bot.mjs")],
      { cwd: root }
    );
    expect(stdout).toContain("Bot-Traces wurden gel");
    expect(stdout).toContain("Anna-Bot-");
    expect(stdout).not.toContain("Testergebnisse");
    expect(await readFile(join(root, "client/src/bot/current-bot.js"), "utf8")).toBe("fixture");
  });
});
