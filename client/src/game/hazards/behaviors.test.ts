import { describe, expect, it } from "vitest";
import { isTimedActive, patrolX, pendulumOffset, spikeheadState } from "./behaviors";

describe("patrolX", () => {
  const def = { minX: 100, maxX: 200, speed: 100 } as const; // period = 2*100/100*1000ms = 2000ms one-way

  it("starts at minX when elapsedMs is 0", () => {
    expect(patrolX(def, 0)).toBeCloseTo(100);
  });

  it("reaches maxX at the halfway point of a full back-and-forth cycle", () => {
    const oneWayMs = ((def.maxX - def.minX) / def.speed) * 1000;
    expect(patrolX(def, oneWayMs)).toBeCloseTo(200, 0);
  });

  it("stays within [minX, maxX] at all times", () => {
    for (let t = 0; t <= 5000; t += 250) {
      const x = patrolX(def, t);
      expect(x).toBeGreaterThanOrEqual(def.minX - 0.001);
      expect(x).toBeLessThanOrEqual(def.maxX + 0.001);
    }
  });
});

describe("isTimedActive", () => {
  it("is active during [0, onMs) with phaseMs=0", () => {
    const def = { onMs: 1500, offMs: 1500, phaseMs: 0 } as const;
    expect(isTimedActive(def, 0)).toBe(true);
    expect(isTimedActive(def, 1499)).toBe(true);
    expect(isTimedActive(def, 1500)).toBe(false);
    expect(isTimedActive(def, 2999)).toBe(false);
    expect(isTimedActive(def, 3000)).toBe(true); // cycle repeats
  });

  it("shifts the cycle by phaseMs", () => {
    const def = { onMs: 1500, offMs: 1500, phaseMs: 750 } as const;
    expect(isTimedActive(def, 0)).toBe(true);
    expect(isTimedActive(def, 800)).toBe(false);
  });

  it("uses default onMs/offMs/phaseMs when not specified", () => {
    const def = {} as const;
    expect(isTimedActive(def, 0)).toBe(true);
    expect(isTimedActive(def, 1500)).toBe(false);
  });
});

describe("pendulumOffset", () => {
  const def = { length: 100, periodMs: 2000, amplitudeDeg: 90 } as const;

  it("is at rest (0 offset) at elapsedMs=0", () => {
    const offset = pendulumOffset(def, 0);
    expect(offset.x).toBeCloseTo(0, 5);
  });

  it("reaches maximum amplitude at a quarter period", () => {
    const offset = pendulumOffset(def, def.periodMs / 4);
    const expectedX = def.length * Math.sin((def.amplitudeDeg * Math.PI) / 180);
    expect(Math.abs(offset.x)).toBeCloseTo(Math.abs(expectedX), 1);
  });
});

describe("spikeheadState", () => {
  const def = {
    originY: 100,
    fallToY: 200,
    warnMs: 400,
    fallMs: 200,
    restMs: 600,
    riseMs: 500,
  } as const;

  it("is idle at originY when never triggered (msSinceTrigger = null)", () => {
    const state = spikeheadState(def, null);
    expect(state.phase).toBe("idle");
    expect(state.y).toBeCloseTo(def.originY);
    expect(state.active).toBe(false);
  });

  it("is in warning phase during [0, warnMs), still at originY, not active", () => {
    expect(spikeheadState(def, 0).phase).toBe("warning");
    expect(spikeheadState(def, 0).y).toBeCloseTo(def.originY);
    expect(spikeheadState(def, 0).active).toBe(false);
    expect(spikeheadState(def, 399).phase).toBe("warning");
    expect(spikeheadState(def, 399).active).toBe(false);
  });

  it("is falling during [warnMs, warnMs+fallMs), interpolating y, active", () => {
    const start = spikeheadState(def, 400);
    expect(start.phase).toBe("falling");
    expect(start.y).toBeCloseTo(def.originY);
    expect(start.active).toBe(true);

    const mid = spikeheadState(def, 500);
    expect(mid.phase).toBe("falling");
    expect(mid.y).toBeCloseTo((def.originY + def.fallToY) / 2, 0);
    expect(mid.active).toBe(true);
  });

  it("is resting at fallToY during [warnMs+fallMs, warnMs+fallMs+restMs), active", () => {
    const state = spikeheadState(def, 600);
    expect(state.phase).toBe("resting");
    expect(state.y).toBeCloseTo(def.fallToY);
    expect(state.active).toBe(true);

    const late = spikeheadState(def, 1199);
    expect(late.phase).toBe("resting");
    expect(late.active).toBe(true);
  });

  it("rises slowly back from fallToY to originY during [warnMs+fallMs+restMs, +riseMs), still active", () => {
    const start = spikeheadState(def, 1200);
    expect(start.phase).toBe("rising");
    expect(start.y).toBeCloseTo(def.fallToY);
    expect(start.active).toBe(true);

    const mid = spikeheadState(def, 1200 + 250);
    expect(mid.phase).toBe("rising");
    expect(mid.y).toBeCloseTo((def.originY + def.fallToY) / 2, 0);
    expect(mid.active).toBe(true);
  });

  it("returns to idle at originY, inactive, once fully risen again", () => {
    const state = spikeheadState(def, 1200 + 500);
    expect(state.phase).toBe("idle");
    expect(state.y).toBeCloseTo(def.originY);
    expect(state.active).toBe(false);
  });

  it("uses default warnMs/fallMs/restMs/riseMs when not specified", () => {
    const bareDef = { originY: 0, fallToY: 50 } as const;
    expect(spikeheadState(bareDef, 0).phase).toBe("warning");
    expect(spikeheadState(bareDef, 100_000).phase).toBe("idle");
  });
});
