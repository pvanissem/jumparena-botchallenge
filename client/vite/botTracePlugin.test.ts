// @vitest-environment node
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOT_TRACE_DIRECTORY, persistBotTrace } from "./botTracePlugin";

const trace = {
  schemaVersion: 1,
  run: {
    startedAt: "2026-08-12T14:37:21.123Z",
    sessionId: "session-1",
    botRevision: "bot-12345678",
    status: "running",
    result: null,
  },
  summary: {},
  events: [],
  findings: [],
  windows: [],
};

describe("persistBotTrace", () => {
  it("stores development traces beside the bot sources", () => {
    expect(BOT_TRACE_DIRECTORY).toMatch(/client\/src\/bot\/runs$/);
  });

  it("atomically grows one file per attempt and never regresses a completed trace", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));

    const first = await persistBotTrace(trace, directory);
    await persistBotTrace({ ...trace, summary: { progress: 0.5 } }, directory);
    await persistBotTrace(
      {
        ...trace,
        run: { ...trace.run, status: "completed", result: "death" },
        summary: { progress: 0.6 },
      },
      directory
    );
    await persistBotTrace({ ...trace, summary: { progress: 0.4 } }, directory);

    expect(first).toBe("2026-08-12T14-37-21-123Z.json");
    expect(await readdir(directory)).toEqual([first]);
    expect(JSON.parse(await readFile(join(directory, first), "utf8"))).toMatchObject({
      run: { status: "completed", result: "death" },
      summary: { progress: 0.6 },
    });
  });

  it("rejects malformed trace structures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    await expect(persistBotTrace({ schemaVersion: 1 }, directory)).rejects.toThrow("Trace");
  });

  it("serializes concurrent flushes for the same attempt", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    const completed = {
      ...trace,
      run: { ...trace.run, status: "completed" as const, result: "death" },
      summary: { progress: 0.8 },
    };

    await Promise.all([
      persistBotTrace({ ...trace, summary: { progress: 0.5 } }, directory),
      persistBotTrace(completed, directory),
      persistBotTrace({ ...trace, summary: { progress: 0.6 } }, directory),
    ]);

    const saved = JSON.parse(
      await readFile(join(directory, "2026-08-12T14-37-21-123Z.json"), "utf8")
    );
    expect(saved).toMatchObject({
      run: { status: "completed", result: "death" },
      summary: { progress: 0.8 },
    });
  });

  it("rejects traces that cannot be assigned to a session and bot revision", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    const withoutIdentity = { ...trace, run: { startedAt: trace.run.startedAt } };

    await expect(persistBotTrace(withoutIdentity, directory)).rejects.toThrow("Trace");
  });
});
