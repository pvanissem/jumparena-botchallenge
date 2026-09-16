// @vitest-environment node
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { BotState } from "@arena/bot-contract";
import type { ViteDevServer } from "vite";
import { describe, expect, it, vi } from "vitest";
import { BotRunRecorder } from "../src/game/trace/BotRunRecorder";
import { compactBotTick } from "../src/game/trace/compactBotTick";
import type { TraceTickSample } from "../src/game/trace/types";
import { BOT_TRACE_DIRECTORY, botTracePlugin, persistBotTrace } from "./botTracePlugin";

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

const sample: TraceTickSample = {
  tick: 1,
  stateTick: 1,
  epoch: 2,
  stateFrame: 3,
  timeMs: 33,
  position: { x: 10, y: 20 },
  velocity: { vx: 20, vy: 0 },
  facing: "right",
  onGround: true,
  isSprinting: false,
  sprintRampProgress: 0,
  gapAhead: { present: false, distance: null },
  goalDirection: { dx: 200, dy: 0 },
  justRespawned: false,
  tookDamage: false,
  nearbyTiles: [],
  hazards: [],
  coins: [],
  platforms: [],
  utilities: [],
  decision: null,
};

const v2 = {
  ...trace,
  schemaVersion: 2,
  windows: [{ fromTick: 1, toTick: 1, reason: "live", samples: [sample] }],
};

describe("persistBotTrace", () => {
  it("enforces the byte cap on the request stream before buffering the whole body", () => {
    const use = vi.fn();
    const plugin = botTracePlugin();
    const configure = plugin.configureServer as (server: ViteDevServer) => void;
    configure({ middlewares: { use } } as unknown as ViteDevServer);
    const handler = use.mock.calls[0][1];
    const request = Object.assign(new PassThrough(), { method: "POST" });
    const response = { statusCode: 0, end: vi.fn() };
    handler(request, response, vi.fn());
    request.write("\u00e4".repeat(1024 * 1024));
    expect(response.end).not.toHaveBeenCalled();
    request.write("x");
    expect(response.statusCode).toBe(413);
    expect(response.end).toHaveBeenCalledOnce();
    request.end("ignored");
    expect(response.end).toHaveBeenCalledOnce();
  });

  it("accepts a real recorder v2 snapshot through persistence", async () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: trace.run.startedAt,
      initial,
    });
    recorder.recordEvent({ kind: "finished", tick: 1, timeMs: 33, position: initial.position });
    const state = {
      ...sample,
      tick: 1,
      timeElapsedMs: 33,
      tuning: { tickMs: 33, minJumpHoldMs: 180 },
    } as unknown as BotState;
    recorder.recordState(state);
    recorder.recordDecision({
      tick: 0,
      stateTick: 1,
      kind: "ok",
      actions: ["right"],
      navigation: {
        targetId: "goal",
        routeId: "route",
        planId: "plan",
        phase: "execute",
        reason: "selected",
        relevantObjectIds: [],
      },
    });
    const recorded = recorder.finish("finished", "goal", initial);
    if (!recorded) throw new Error("Expected trace");
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    const filename = await persistBotTrace(recorded, directory);
    const body = await readFile(join(directory, filename), "utf8");
    expect(JSON.parse(body)).toEqual(recorded);
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it.each([
    { position: { x: "bad", y: 20 } },
    { platforms: [{ id: "landing", dx: 1, dy: 2, width: -1, height: 2, kind: "float" }] },
    {
      utilities: [
        {
          id: "boingo",
          dx: 1,
          dy: 2,
          kind: "boingo",
          bounds: { dx: 1, dy: 2, width: "bad", height: 2 },
        },
      ],
    },
    { decision: { tick: 0, stateTick: 99, epoch: 2, kind: "ok", actions: [] } },
    { decision: { tick: 0, stateTick: 1, epoch: 99, kind: "ok", actions: [] } },
    { decision: { tick: 0, stateTick: 1, epoch: 2, stateFrame: 99, kind: "ok", actions: [] } },
    { decision: { tick: 0, stateTick: 1, epoch: 2, kind: "ok", actions: ["fly"] } },
    { navigation: { version: 1, epoch: 2, frame: 3 } },
  ])("rejects malformed v2 geometry and contradictory decision correlation", async (patch) => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    const value = { ...v2, windows: [{ ...v2.windows[0], samples: [{ ...sample, ...patch }] }] };
    await expect(persistBotTrace(value, directory)).rejects.toThrow("Trace");
  });

  it.each(["workerDurationMs", "roundTripMs"])(
    "ignores unused decision metadata %s",
    async (field) => {
      const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
      const decision = { tick: 0, stateTick: 1, epoch: 2, kind: "ok", actions: [], [field]: "unused" };
      await expect(
        persistBotTrace(
          { ...v2, windows: [{ ...v2.windows[0], samples: [{ ...sample, decision }] }] },
          directory
        )
      ).resolves.toMatch(/json$/);
    }
  );

  it("accepts compact v2 geometry and observation with matching navigation diagnostics", async () => {
    const state = {
      ...sample,
      tick: 1,
      timeElapsedMs: 33,
      navigation: {
        version: 1,
        epoch: 2,
        frame: 3,
        observedAtMs: 33,
        physicsStepMs: 1000 / 60,
        body: { x: 1, y: 2, width: 24, height: 32 },
        viewport: { x: 0, y: 0, width: 800, height: 540 },
        movement: { impulseKind: "none", impulseAtMs: null, jumpStartedAtMs: null, sourceId: null },
        boingoJumpVelocity: -700,
        stompJumpVelocity: -400,
      },
    } as unknown as BotState;
    const compact = compactBotTick(state);
    compact.decision = {
      tick: 0,
      stateTick: 1,
      epoch: 2,
      stateFrame: 3,
      kind: "ok",
      actions: ["right"],
      navigation: {
        targetId: "goal",
        routeId: "r",
        planId: "p",
        phase: "execute",
        reason: "selected",
        relevantObjectIds: [],
      },
    };
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    await expect(
      persistBotTrace({ ...v2, windows: [{ ...v2.windows[0], samples: [compact] }] }, directory)
    ).resolves.toMatch(/json$/);
  });

  it("persists v2 without inventing fields when accepting persisted v1", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    const v2 = { ...trace, schemaVersion: 2 };
    const filename = await persistBotTrace(v2, directory);
    expect(JSON.parse(await readFile(join(directory, filename), "utf8"))).toEqual(v2);
    const v1Directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    const v1Filename = await persistBotTrace(trace, v1Directory);
    expect(JSON.parse(await readFile(join(v1Directory, v1Filename), "utf8"))).toEqual(trace);
  });

  it.each([
    { ...trace, schemaVersion: 3 },
    { ...trace, schemaVersion: 2, windows: Array(9).fill({}) },
    {
      ...trace,
      schemaVersion: 2,
      windows: [
        {
          fromTick: 0,
          toTick: 1,
          reason: "test",
          samples: [{ tick: 0, decision: { kind: "ok", navigation: { phase: "execute" } } }],
        },
      ],
    },
    { ...trace, summary: { text: "\u00e4".repeat(1024 * 1024) } },
  ])("rejects invalid versions, v2 windows/diagnostics and oversized JSON", async (value) => {
    const directory = await mkdtemp(join(tmpdir(), "bot-runs-"));
    await expect(persistBotTrace(value, directory)).rejects.toThrow("Trace");
    expect(await readdir(directory)).toEqual([]);
  });

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
