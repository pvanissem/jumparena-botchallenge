import { describe, expect, it } from "vitest";
import { isTimedActive, patrolX, pendulumOffset } from "./behaviors";

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
