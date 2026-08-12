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
