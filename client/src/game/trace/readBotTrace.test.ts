// @vitest-environment node
import { describe, expect, it } from "vitest";
import { focusTrace, serializeReport, summarizeTrace } from "./readBotTrace";
import type { BotRunTrace, TraceTickSample } from "./types";

function trace(): BotRunTrace {
  const sample = (tick: number) =>
    ({
      tick,
      timeMs: tick * 33,
      position: { x: tick, y: 10 },
      velocity: { vx: 10, vy: 0 },
      onGround: true,
      facing: "right",
      isSprinting: false,
      sprintRampProgress: 0,
      gapAhead: { present: false, distance: null },
      goalDirection: { dx: 100, dy: 0 },
      justRespawned: false,
      tookDamage: false,
      nearbyTiles: [["empty"]],
      hazards: [],
      coins: [],
      platforms: [],
      decision: { kind: "ok", tick, actions: ["right"] },
    }) as TraceTickSample;
  return {
    schemaVersion: 2,
    run: {
      levelId: "test",
      sessionId: "session",
      botRevision: "bot-old",
      status: "completed",
      startedAt: "2026-01-01T00:00:00Z",
      flushedAt: "2026-01-01T00:00:01Z",
      endedAt: "2026-01-01T00:00:01Z",
      result: "death",
      endReason: "pit-fall",
      durationMs: 1000,
      tuning: { tickMs: 33, minJumpHoldMs: 180 },
    },
    summary: {
      startPosition: { x: 0, y: 10 },
      endPosition: { x: 30, y: 10 },
      maxProgress: 0.1,
      coinsCollected: 0,
      fruitScore: 0,
      technicalErrors: 0,
      deathCause: "pit-fall",
    },
    events: [
      {
        id: "event",
        kind: "pit-fall",
        observed: true,
        tick: 30,
        timeMs: 990,
        position: { x: 30, y: 10 },
      },
    ],
    findings: [
      {
        kind: "stuck",
        derived: true,
        severity: "warning",
        message: "Hint",
        ticks: [1, 2, 3],
        eventIds: [],
      },
    ],
    windows: [
      {
        fromTick: 0,
        toTick: 30,
        reason: "end",
        samples: Array.from({ length: 31 }, (_, i) => sample(i)),
      },
    ],
    truncation: {
      reasons: ["byte-limit"],
      omittedSamples: 100,
      omittedEvents: 0,
      omittedFindings: 0,
    },
  };
}
describe("compact trace reader", () => {
  it("keeps attempt identity, revision mismatch and truncation without raw samples", () => {
    const report = summarizeTrace(trace(), "bot-new");
    expect(report.currentCode).toBe(false);
    expect(report.attempt.sessionId).toBe("session");
    expect(report.traceTruncation?.omittedSamples).toBe(100);
    expect(report.hints[0].ticks).toEqual({ from: 1, to: 3, count: 3 });
    expect(JSON.stringify(report)).not.toContain('"samples":');
    expect(JSON.stringify(report)).not.toContain('"nearbyTiles":');
  });
  it("deduplicates overlapping windows and bounds timeline length", () => {
    const input = trace();
    input.windows.push(input.windows[0]);
    const report = focusTrace(input, 15, "bot-old");
    expect(report.currentCode).toBe(true);
    expect(report.coverage.availableSamples).toBe(31);
    expect(report.timeline.length).toBeLessThanOrEqual(7);
    expect(new Set(report.timeline.map((s) => s.tick)).size).toBe(report.timeline.length);
    expect(report.snapshot?.tick).toBe(15);
  });
  it("reports missing ticks instead of inventing observations", () => {
    const report = focusTrace(trace(), 200, "bot-old");
    expect(report.coverage.exactTickAvailable).toBe(false);
    expect(report.coverage.nearestTick).toBe(30);
    expect(report.timeline).toEqual([]);
    expect(report.snapshot).toBeNull();
  });
  it("prioritizes the command target in bounded geometry", () => {
    const input = trace(),
      s = input.windows[0].samples[15];
    s.platforms = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      dx: i,
      dy: 10,
      width: 20,
      height: 10,
      kind: "ground",
    }));
    s.decision = {
      kind: "ok",
      tick: s.tick,
      actions: ["right"],
      navigation: {
        targetId: "p29",
        planId: "cmd",
        routeId: null,
        phase: "execute",
        reason: "flight",
        relevantObjectIds: [],
      },
    };
    const report = focusTrace(input, 15, "bot-old");
    expect(report.snapshot?.platforms.items[0].id).toBe("p29");
    expect(report.snapshot?.platforms.omitted).toBe(24);
  });
  it("keeps actionable evidence when a summary exceeds the output budget", () => {
    const input = trace();
    input.findings[0].message = "long hint ".repeat(4000);
    const report = { file: "attempt.json", ...summarizeTrace(input, "bot-old") };
    const output = serializeReport(report);
    const reduced = JSON.parse(output);
    expect(output.length).toBeLessThanOrEqual(12000);
    expect(reduced.outputLimited).toBe(true);
    expect(reduced.file).toBe("attempt.json");
    expect(reduced.currentCode).toBe(true);
    expect(reduced.summary.deathCause).toBe("pit-fall");
    expect(reduced.hints[0].ticks.from).toBe(1);
    expect(reduced.recentEvents[0].tick).toBe(30);
    expect(reduced.attempt.botRevision).toBe("bot-old");
    expect(reduced.nextStep).not.toMatch(/Rohdaten.*lesen/);
  });
  it("keeps the target and geometry in an oversized focus report", () => {
    const input = trace();
    input.windows[0].samples[15].decision = {
      kind: "runtime-error",
      tick: 15,
      actions: [],
      message: "error".repeat(5000),
    };
    const reduced = JSON.parse(serializeReport(focusTrace(input, 15, "bot-old")));
    expect(reduced.outputLimited).toBe(true);
    expect(reduced.coverage.requestedTick).toBe(15);
    expect(reduced.snapshot.position).toEqual({ x: 15, y: 10 });
    expect(reduced.snapshot.decision.kind).toBe("runtime-error");
  });
  it("always emits valid bounded JSON", () => {
    const output = serializeReport({ message: "x".repeat(30000) });
    expect(output.length).toBeLessThanOrEqual(12000);
    expect(JSON.parse(output).outputLimited).toBe(true);
  });
});
