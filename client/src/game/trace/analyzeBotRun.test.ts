import { describe, expect, it } from "vitest";
import { analyzeBotRun } from "./analyzeBotRun";
import type { TraceEvent, TraceTickSample } from "./types";

function sample(
  tick: number,
  x: number,
  action: "sprint-left" | "sprint-right" = "sprint-right"
): TraceTickSample {
  return {
    tick,
    timeMs: tick * 100,
    position: { x, y: 100 },
    velocity: { vx: action.endsWith("right") ? 200 : -200, vy: 0 },
    facing: action.endsWith("right") ? "right" : "left",
    onGround: true,
    isSprinting: true,
    sprintRampProgress: 1,
    gapAhead: { present: false, distance: null },
    goalDirection: { dx: 500, dy: 0 },
    justRespawned: false,
    tookDamage: false,
    nearbyTiles: [],
    hazards: [],
    coins: [],
    platforms: [],
    decision: { tick, kind: "ok", actions: [action] },
  };
}

function death(kind: "pit-fall" | "hazard-hit", tick: number): TraceEvent {
  return {
    id: "death",
    kind,
    observed: true,
    tick,
    timeMs: tick * 100,
    position: { x: 10, y: 500 },
    details: kind === "hazard-hit" ? { hazardKind: "stachlinger" } : undefined,
  };
}

describe("analyzeBotRun", () => {
  it("detects requested movement that makes no progress", () => {
    const moving = Array.from({ length: 31 }, (_, tick) => sample(tick, tick % 2));

    expect(
      analyzeBotRun(moving, [], { tickMs: 100, minJumpHoldMs: 180 }).map((f) => f.kind)
    ).toContain("stuck");
  });

  it("detects idle without progress but not deliberate waiting at an active loderix", () => {
    const idle = Array.from({ length: 31 }, (_, tick) => ({
      ...sample(tick, 100),
      decision: { tick, kind: "ok" as const, actions: [] },
    }));
    const waiting = idle.map((entry) => ({
      ...entry,
      hazards: [
        {
          dx: 40,
          dy: 0,
          kind: "loderix" as const,
          active: true,
          warning: false,
          stompable: false,
          vx: 0,
          vy: 0,
        },
      ],
    }));

    expect(
      analyzeBotRun(idle, [], { tickMs: 100, minJumpHoldMs: 180 }).map((f) => f.kind)
    ).toContain("stuck");
    expect(
      analyzeBotRun(waiting, [], { tickMs: 100, minJumpHoldMs: 180 }).map((f) => f.kind)
    ).not.toContain("stuck");
  });

  it("detects repeated direction changes without progress", () => {
    const samples = Array.from({ length: 20 }, (_, tick) =>
      sample(tick, tick % 2, tick % 2 ? "sprint-left" : "sprint-right")
    );

    expect(
      analyzeBotRun(samples, [], { tickMs: 100, minJumpHoldMs: 180 }).map((f) => f.kind)
    ).toContain("oscillating");
  });

  it("detects a visible missed gap before a pit fall", () => {
    const samples = Array.from({ length: 12 }, (_, tick) => sample(tick, tick * 10));
    for (const tick of [7, 8, 9, 10]) samples[tick].gapAhead = { present: true, distance: 20 };

    expect(
      analyzeBotRun(samples, [death("pit-fall", 11)], { tickMs: 100, minJumpHoldMs: 180 }).map(
        (f) => f.kind
      )
    ).toContain("missed-gap");
  });

  it("does not blame the bot for an unseen hazard", () => {
    const samples = Array.from({ length: 8 }, (_, tick) => sample(tick, tick * 10));

    expect(
      analyzeBotRun(samples, [death("hazard-hit", 7)], { tickMs: 100, minJumpHoldMs: 180 }).map(
        (f) => f.kind
      )
    ).not.toContain("hazard-not-avoided");
  });

  it("reports a visible active hazard before contact", () => {
    const samples = Array.from({ length: 8 }, (_, tick) => sample(tick, tick * 10));
    samples[6].hazards = [
      {
        dx: 15,
        dy: 0,
        kind: "stachlinger",
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];

    expect(
      analyzeBotRun(samples, [death("hazard-hit", 7)], { tickMs: 100, minJumpHoldMs: 180 }).map(
        (f) => f.kind
      )
    ).toContain("hazard-not-avoided");
  });

  it("reports a jump released before the minimum hold time before death", () => {
    const samples = Array.from({ length: 8 }, (_, tick) => sample(tick, tick * 10));
    samples[4].decision = { tick: 4, kind: "ok", actions: ["jump", "sprint-right"] };
    samples[4].velocity.vy = -500;
    samples[5].decision = { tick: 5, kind: "ok", actions: ["sprint-right"] };
    samples[5].velocity.vy = 0;

    expect(
      analyzeBotRun(samples, [death("pit-fall", 7)], { tickMs: 100, minJumpHoldMs: 180 }).map(
        (f) => f.kind
      )
    ).toContain("jump-cut-short");
  });
});
