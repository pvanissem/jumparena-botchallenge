import { describe, expect, it } from "vitest";
import { selectTraceWindows } from "./selectTraceWindows";
import type { TraceTickSample } from "./types";

function sample(tick: number): TraceTickSample {
  return {
    tick,
    timeMs: tick * 33,
    position: { x: tick, y: 0 },
    velocity: { vx: 1, vy: 0 },
    facing: "right",
    onGround: true,
    isSprinting: false,
    sprintRampProgress: 0,
    gapAhead: { present: false, distance: null },
    goalDirection: { dx: 100, dy: 0 },
    justRespawned: false,
    tookDamage: false,
    nearbyTiles: [],
    hazards: [],
    coins: [],
    platforms: [],
    decision: null,
  };
}

describe("selectTraceWindows", () => {
  it("takes exactly 45 observation ticks before and ten after an isolated anchor", () => {
    const samples = Array.from({ length: 200 }, (_, tick) => sample(tick));
    const windows = selectTraceWindows(samples, [{ tick: 100, reason: "plan" }]);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ fromTick: 55, toTick: 110 });
    expect(windows[0].samples).toHaveLength(56);
  });

  it("clamps and merges overlapping windows", () => {
    const samples = Array.from({ length: 100 }, (_, tick) => sample(tick));
    const windows = selectTraceWindows(samples, [
      { tick: 5, reason: "start" },
      { tick: 40, reason: "overlap" },
      { tick: 95, reason: "end" },
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ fromTick: 0, toTick: 99 });
    expect(windows[0].samples).toHaveLength(100);
  });

  it("limits output to eight non-overlapping windows", () => {
    const samples = Array.from({ length: 2_000 }, (_, tick) => sample(tick));
    const anchors = Array.from({ length: 10 }, (_, i) => ({ tick: 100 + i * 150, reason: `${i}` }));

    expect(selectTraceWindows(samples, anchors)).toHaveLength(8);
  });

  it("keeps a required terminal window when ordinary anchors exceed the limit", () => {
    const samples = Array.from({ length: 2_000 }, (_, tick) => sample(tick));
    const anchors = [
      ...Array.from({ length: 10 }, (_, i) => ({ tick: 100 + i * 150, reason: `${i}` })),
      { tick: 1_999, reason: "time-limit", required: true },
    ];

    const windows = selectTraceWindows(samples, anchors);

    expect(windows).toHaveLength(8);
    expect(windows.at(-1)?.reason).toContain("time-limit");
    expect(windows.at(-1)?.samples.at(-1)?.tick).toBe(1_999);
  });
});
