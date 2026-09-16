// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { runTraceCommand } from "../../../../scripts/bot-trace.mjs";
import { botRevisionForSource } from "./botTraceIdentity";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "trace-reader-"));
  dirs.push(dir);
  const botFile = join(dir, "current-bot.js"),
    runsDir = join(dir, "runs");
  await writeFile(botFile, "current source");
  await mkdir(runsDir);
  async function save(file: string, revision = botRevisionForSource("current source")) {
    await writeFile(
      join(runsDir, file),
      JSON.stringify({
        schemaVersion: 2,
        run: { botRevision: revision, sessionId: "session", result: "death", status: "completed" },
        summary: { deathCause: "pit-fall" },
        events: [],
        findings: [],
        windows: [],
      })
    );
  }
  return { botFile, runsDir, save };
}
it("defaults to current revision, skipping broken or mismatched files", async () => {
  const env = await setup();
  await env.save("old.json", "bot-other");
  await env.save("matching.json");
  await writeFile(join(env.runsDir, "broken.json"), "{");
  const report = await runTraceCommand([], env);
  expect(report).toMatchObject({ currentCode: true, file: join(env.runsDir, "matching.json") });
  expect(await runTraceCommand(["summary", "old.json"], env)).toMatchObject({ currentCode: false });
  await expect(runTraceCommand(["summary", "broken.json"], env)).rejects.toThrow();
});
it("does not substitute an old attempt when the current code has no trace", async () => {
  const env = await setup();
  await env.save("old.json", "bot-other");
  expect(await runTraceCommand([], env)).toMatchObject({
    message: expect.stringContaining("Kein Trace"),
  });
});
it("bounds list and handles missing runs directories", async () => {
  const env = await setup();
  for (let i = 0; i < 8; i++) await env.save(`${i}.json`);
  expect((await runTraceCommand(["list"], env)).attempts).toHaveLength(5);
  await rm(env.runsDir, { recursive: true });
  expect((await runTraceCommand(["list"], env)).attempts).toEqual([]);
});
it("rejects unsupported or unbounded arguments", async () => {
  const env = await setup();
  for (const args of [
    ["focus"],
    ["focus", "a.json", "-1"],
    ["focus", "a.json", "1.5"],
    ["list", "extra"],
  ])
    await expect(runTraceCommand(args, env)).rejects.toThrow("Ungültiger Aufruf");
});
it("runs the actual CLI through the installed Node without a build or server", () => {
  const script = new URL("../../../../scripts/bot-trace.mjs", import.meta.url);
  const output = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      script.pathname,
      "help",
    ],
    { encoding: "utf8" }
  );
  expect(JSON.parse(output).usage).toHaveLength(4);
});
