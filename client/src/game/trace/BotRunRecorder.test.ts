import type { BotState } from "@arena/bot-contract";
import { describe, expect, it } from "vitest";
import { BotRunRecorder } from "./BotRunRecorder";

function state(tick: number): BotState {
  return {
    tick,
    position: { x: 10 + tick, y: 20 },
    facing: "right",
    onGround: true,
    isAlive: true,
    velocity: { vx: 200, vy: 0 },
    isSprinting: false,
    sprintRampProgress: 0,
    nearbyTiles: [],
    platforms: [],
    tuning: {
      gravity: 900,
      tileSize: 16,
      tickMs: 33,
      baseMoveSpeed: 200,
      sprintMoveSpeed: 320,
      sprintRampMs: 450,
      baseJumpVelocity: -560,
      sprintJumpVelocity: -650,
      minJumpHoldMs: 180,
      botWidth: 24,
      botHeight: 32,
    },
    coins: [],
    hazards: [],
    utilities: [],
    nearestCoin: null,
    nearestHazard: null,
    nearestUtility: null,
    goalDirection: { dx: 90 - tick, dy: 0 },
    gapAhead: { present: false, distance: null },
    worldBounds: { width: 100, height: 100 },
    justRespawned: false,
    tookDamage: false,
    coinsCollected: 3 + tick,
    livesRemaining: Infinity,
    timeElapsedMs: tick * 33,
  };
}

describe("BotRunRecorder", () => {
  it("anchors a previous command failure even when the current diagnostic is unchanged", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "test",
      sessionId: "test",
      botRevision: "bot",
      startedAt: "2026-09-17",
      initial,
    });
    for (let tick = 0; tick < 600; tick++) {
      recorder.recordState(state(tick));
      recorder.recordDecision({
        tick,
        kind: "ok",
        actions: ["right"],
        navigation: {
          targetId: null,
          routeId: null,
          planId: "walk",
          phase: "execute",
          reason: "approach",
          relevantObjectIds: [],
          ...(tick === 100
            ? {
                statusTransition: {
                  commandId: "old",
                  targetId: "floor",
                  state: "failed" as const,
                  phase: "flight" as const,
                  reason: "wrong-landing",
                },
              }
            : {}),
        },
      });
    }
    const trace = recorder.snapshot(initial);
    expect(trace?.windows.some((w) => w.reason.includes("wrong-landing"))).toBe(true);
    expect(
      trace?.windows.flatMap((w) => w.samples).find((s) => s.tick === 100)?.decision
    ).toHaveProperty("navigation.statusTransition.commandId", "old");
  });
  it("keeps action correlation without expanding diagnostic windows to the whole run", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial,
    });
    for (let tick = 0; tick < 600; tick++) {
      recorder.recordState(state(tick));
      recorder.recordDecision({ tick, kind: "ok", actions: ["right"] });
      recorder.recordEvent({
        kind: "action-applied",
        tick,
        timeMs: tick * 33,
        position: state(tick).position,
        details: { stateTick: tick, stateFrame: tick * 2, epoch: 1, appliedFrame: tick * 2 + 1 },
      });
      if (tick === 100)
        recorder.recordEvent({
          kind: "coin-collected",
          tick,
          timeMs: tick * 33,
          position: state(tick).position,
        });
    }
    const trace = recorder.finish("time-limit", "time-limit", initial);
    if (!trace) throw new Error("Expected trace");
    expect(trace.windows.map(({ fromTick, toTick }) => ({ fromTick, toTick }))).toEqual([
      { fromTick: 55, toTick: 110 },
      { fromTick: 554, toTick: 599 },
    ]);
    expect(trace.windows.flatMap((window) => window.samples)).toHaveLength(102);
    expect(trace.windows.every((window) => !window.reason.includes("action-applied"))).toBe(true);
    const applied = trace.events.filter((event) => event.kind === "action-applied");
    expect(applied).toHaveLength(600);
    expect(applied[300]).toMatchObject({
      tick: 300,
      details: { stateTick: 300, stateFrame: 600, epoch: 1, appliedFrame: 601 },
    });
  });

  it("anchors navigation problems even without a collision or terminal event nearby", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial,
    });
    for (let tick = 0; tick < 600; tick++) {
      recorder.recordState(state(tick));
      if (tick >= 100 && tick < 110)
        recorder.recordDecision({
          tick,
          kind: "ok",
          actions: [],
          navigation: {
            targetId: "coin-9",
            routeId: null,
            planId: null,
            phase: "blocked",
            reason: "no-known-continuation",
            relevantObjectIds: ["platform-7"],
          },
        });
    }
    const trace = recorder.snapshot(initial);
    if (!trace) throw new Error("Expected trace");
    expect(trace.windows[0]).toMatchObject({ fromTick: 55, toTick: 110 });
    expect(trace.windows[0].reason).toContain("no-known-continuation");
    expect(trace.windows[0].samples.find((s) => s.tick === 100)?.decision?.navigation?.phase).toBe(
      "blocked"
    );
  });

  it("writes v2 and correlates a worker request by stateTick and epoch, not request tick", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial,
    });
    const observed = state(42);
    observed.navigation = {
      version: 1,
      epoch: 3,
      frame: 88,
      observedAtMs: 1000,
      physicsStepMs: 1000 / 60,
      body: { x: 40, y: 0, width: 24, height: 32 },
      viewport: { x: 0, y: 0, width: 800, height: 540 },
      movement: { jumpStartedAtMs: null, impulseKind: "none", impulseAtMs: null, sourceId: null },
      boingoJumpVelocity: -700,
      stompJumpVelocity: -400,
    };
    recorder.recordState(observed);
    const navigation = {
      targetId: "coin-9",
      routeId: "r",
      planId: "p",
      phase: "execute" as const,
      reason: "route-selected",
      relevantObjectIds: ["landing"],
      navigationActions: ["right" as const],
    };
    recorder.recordDecision({
      tick: 0,
      stateTick: 42,
      epoch: 2,
      kind: "ok",
      actions: ["left"],
      navigation,
    });
    expect(recorder.snapshot(initial)?.windows[0].samples[0].decision).toBeNull();
    recorder.recordDecision({
      tick: 0,
      stateTick: 42,
      epoch: 3,
      stateFrame: 88,
      kind: "ok",
      actions: ["left"],
      navigation,
    });
    const trace = recorder.snapshot(initial);
    if (!trace) throw new Error("Expected trace");
    expect(trace.schemaVersion).toBe(2);
    expect(trace.windows[0].samples[0].decision).toMatchObject({
      tick: 0,
      stateTick: 42,
      epoch: 3,
      navigation: { ...navigation, actionOverride: "navigation-output-overridden" },
    });
    recorder.recordDecision({
      tick: 1,
      stateTick: 42,
      epoch: 3,
      kind: "ok",
      actions: [],
      navigation: { ...navigation, reason: "x".repeat(3000) },
    });
    expect(recorder.snapshot(initial)?.windows[0].samples[0].decision).not.toHaveProperty(
      "navigation"
    );
    // Previously emitted snapshots must not change as later answers arrive.
    expect(trace.windows[0].samples[0].decision?.actions).toEqual(["left"]);
  });

  it("caps serialized v2 output at 2 MiB and explicitly marks discarded evidence", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial,
    });
    for (let tick = 0; tick < 100; tick++) {
      const observed = state(tick);
      observed.platforms = Array.from({ length: 500 }, (_, i) => ({
        id: `platform-${i}`,
        dx: i,
        dy: 20,
        width: 20,
        height: 20,
        kind: "ground",
        collision: "solid",
      }));
      recorder.recordState(observed);
      recorder.recordEvent({
        kind: "coin-collected",
        tick,
        timeMs: tick * 33,
        position: observed.position,
      });
    }
    const trace = recorder.finish("time-limit", "time-limit", initial);
    if (!trace) throw new Error("Expected trace");
    expect(new TextEncoder().encode(JSON.stringify(trace)).byteLength).toBeLessThanOrEqual(
      2 * 1024 * 1024
    );
    expect(trace.truncation?.reasons).toContain("byte-limit");
    expect(trace.windows.at(-1)?.samples.at(-1)?.tick).toBe(99);
  });

  it("marks evidence omitted by the eight-window limit", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial,
    });
    for (let tick = 0; tick < 2000; tick++) {
      recorder.recordState(state(tick));
      if (tick % 150 === 0)
        recorder.recordEvent({
          kind: "coin-collected",
          tick,
          timeMs: tick * 33,
          position: { x: tick, y: 20 },
        });
    }
    const trace = recorder.snapshot(initial);
    if (!trace) throw new Error("Expected trace");
    expect(trace.windows).toHaveLength(8);
    expect(trace.truncation?.reasons).toEqual(["window-limit"]);
    expect(trace.truncation?.omittedSamples).toBeGreaterThan(0);
    expect(trace.windows.at(-1)?.samples.at(-1)?.tick).toBe(1999);
  });

  it("keeps plan-referenced geometry after async decisions and records application only as an event", () => {
    const initial = { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 };
    const recorder = new BotRunRecorder({
      levelId: "one",
      sessionId: "session",
      botRevision: "bot",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial,
    });
    const observed = state(42);
    observed.platforms = Array.from({ length: 8 }, (_, i) => ({
      id: `platform-${i}`,
      dx: i * 20,
      dy: 10,
      width: 20,
      height: 20,
      kind: "float",
      collision: "one-way-up",
    }));
    observed.utilities = [
      {
        id: "boingo-1",
        kind: "boingo",
        dx: 80,
        dy: 20,
        bounds: { dx: 70, dy: 10, width: 20, height: 20 },
      },
    ];
    recorder.recordState(observed);
    recorder.recordDecision({
      tick: 0,
      stateTick: 42,
      kind: "ok",
      actions: ["jump"],
      navigation: {
        targetId: "coin-9",
        routeId: "r",
        planId: "p",
        phase: "execute",
        reason: "bounce",
        relevantObjectIds: ["platform-7", "boingo-1"],
      },
    });
    const before = recorder.snapshot(initial);
    if (!before) throw new Error("Expected trace");
    expect(before.events).toEqual([]);
    expect(before.windows[0].samples[0].platforms).toContainEqual(observed.platforms[7]);
    expect(before.windows[0].samples[0].utilities).toEqual(observed.utilities);
    recorder.recordEvent({
      kind: "action-applied",
      tick: 42,
      timeMs: 1400,
      position: observed.position,
      details: { stateTick: 42, stateFrame: 84, epoch: 1, appliedFrame: 86, actions: '["jump"]' },
    });
    expect(before.events).toEqual([]);
    expect(recorder.snapshot(initial)?.events[0]).toMatchObject({
      observed: true,
      kind: "action-applied",
      details: { stateTick: 42, stateFrame: 84, epoch: 1, appliedFrame: 86, actions: '["jump"]' },
    });
    const isolated = recorder.snapshot(initial)!;
    isolated.events[0].details!.appliedFrame = 999;
    isolated.windows[0].samples[0].platforms[7].width = 999;
    const decision = isolated.windows[0].samples[0].decision;
    if (decision?.kind !== "ok") throw new Error("Expected successful decision");
    decision.actions.push("left");
    expect(recorder.snapshot(initial)).toMatchObject({
      events: [{ details: { appliedFrame: 86 } }],
      windows: [{ samples: [{ decision: { actions: ["jump"] } }] }],
    });
    expect(recorder.snapshot(initial)?.windows[0].samples[0].platforms[7].width).toBe(20);
    recorder.finish("finished", "goal", initial);
    recorder.recordDecision({ tick: 0, stateTick: 42, kind: "timeout", actions: [] });
    expect(before.windows[0].samples[0].decision?.kind).toBe("ok");
  });

  it("correlates decisions and computes per-run deltas", () => {
    const recorder = new BotRunRecorder({
      levelId: "level-one",
      sessionId: "session-test",
      botRevision: "bot-test",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 3, fruitScore: 20 },
    });
    recorder.recordState(state(1));
    recorder.recordDecision({ tick: 1, kind: "ok", actions: ["right"] });
    recorder.recordEvent({
      kind: "coin-collected",
      tick: 1,
      timeMs: 33,
      position: { x: 11, y: 20 },
      details: { value: 5 },
    });

    const trace = recorder.finish("finished", "goal", {
      position: { x: 100, y: 20 },
      coinsCollected: 4,
      fruitScore: 25,
    });

    expect(trace?.summary).toMatchObject({ coinsCollected: 1, fruitScore: 5 });
    expect(trace?.windows[0].samples[0].decision).toEqual({
      tick: 1,
      kind: "ok",
      actions: ["right"],
    });
  });

  it("finishes exactly once and ignores an empty abort", () => {
    const empty = new BotRunRecorder({
      levelId: "level-one",
      sessionId: "session-test",
      botRevision: "bot-test",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 },
    });
    expect(
      empty.finish("aborted", "restart", {
        position: { x: 10, y: 20 },
        coinsCollected: 0,
        fruitScore: 0,
      })
    ).toBeNull();

    const recorder = new BotRunRecorder({
      levelId: "level-one",
      sessionId: "session-test",
      botRevision: "bot-test",
      startedAt: "2026-08-12T10:00:00.000Z",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 },
    });
    recorder.recordState(state(1));
    recorder.recordEvent({ kind: "pit-fall", tick: 1, timeMs: 33, position: { x: 44, y: 500 } });
    const trace = recorder.finish("death", "pit-fall", {
      position: { x: 44, y: 500 },
      coinsCollected: 0,
      fruitScore: 0,
    });

    expect(trace?.summary.endPosition).toEqual({ x: 44, y: 500 });
    expect(
      recorder.finish("death", "pit-fall", {
        position: { x: 44, y: 500 },
        coinsCollected: 0,
        fruitScore: 0,
      })
    ).toBeNull();
  });

  it("reports time relative to this attempt after a respawn", () => {
    const recorder = new BotRunRecorder({
      levelId: "level-one",
      sessionId: "session-test",
      botRevision: "bot-test",
      startedAt: "2026-08-12T10:00:05.000Z",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 },
    });
    const first = state(100);
    first.timeElapsedMs = 5_000;
    const second = state(103);
    second.timeElapsedMs = 5_100;
    recorder.recordState(first);
    recorder.recordState(second);
    recorder.recordEvent({
      kind: "pit-fall",
      tick: 103,
      timeMs: 5_100,
      position: { x: 44, y: 500 },
    });

    const trace = recorder.finish("death", "pit-fall", {
      position: { x: 44, y: 500 },
      coinsCollected: 0,
      fruitScore: 0,
    });

    expect(trace?.run.durationMs).toBe(100);
    expect(trace?.events[0].timeMs).toBe(100);
    expect(trace?.windows[0].samples.map((sample) => sample.timeMs)).toEqual([0, 100]);
  });

  it("always keeps terminal evidence even when an earlier event already created a window", () => {
    const recorder = new BotRunRecorder({
      levelId: "level-one",
      startedAt: "2026-08-12T10:00:00.000Z",
      sessionId: "session-7",
      botRevision: "bot-a1b2c3d4",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 },
    });
    for (let tick = 0; tick < 200; tick++) recorder.recordState(state(tick));
    recorder.recordEvent({
      kind: "coin-collected",
      tick: 1,
      timeMs: 33,
      position: { x: 11, y: 20 },
    });

    const trace = recorder.finish("time-limit", "time-limit", {
      position: { x: 209, y: 20 },
      coinsCollected: 1,
      fruitScore: 5,
    });

    expect(trace?.run).toMatchObject({ sessionId: "session-7", botRevision: "bot-a1b2c3d4" });
    expect(trace?.windows.at(-1)?.reason).toContain("time-limit");
    expect(trace?.windows.at(-1)?.samples.at(-1)?.tick).toBe(199);
  });

  it("creates a readable running snapshot without finishing the recorder", () => {
    const recorder = new BotRunRecorder({
      levelId: "level-one",
      startedAt: "2026-08-12T10:00:00.000Z",
      sessionId: "session-live",
      botRevision: "bot-live",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 },
    });
    for (let tick = 0; tick < 100; tick++) recorder.recordState(state(tick));

    const running = recorder.snapshot({
      position: { x: 109, y: 20 },
      coinsCollected: 0,
      fruitScore: 0,
    });
    const completed = recorder.finish("death", "pit-fall", {
      position: { x: 110, y: 500 },
      coinsCollected: 0,
      fruitScore: 0,
    });

    expect(running?.run).toMatchObject({
      status: "running",
      result: null,
      endReason: null,
      endedAt: null,
    });
    expect(running?.windows.at(-1)?.reason).toContain("live");
    expect(running?.windows.at(-1)?.samples.at(-1)?.tick).toBe(99);
    expect(completed?.run).toMatchObject({ status: "completed", result: "death" });
  });

  it("does not count a still-pending decision as a technical error", () => {
    const recorder = new BotRunRecorder({
      levelId: "level-one",
      startedAt: "2026-08-12T10:00:00.000Z",
      sessionId: "session-live",
      botRevision: "bot-live",
      initial: { position: { x: 10, y: 20 }, coinsCollected: 0, fruitScore: 0 },
    });
    recorder.recordState(state(1));

    expect(
      recorder.snapshot({ position: { x: 11, y: 20 }, coinsCollected: 0, fruitScore: 0 })?.summary
        .technicalErrors
    ).toBe(0);
  });
});
