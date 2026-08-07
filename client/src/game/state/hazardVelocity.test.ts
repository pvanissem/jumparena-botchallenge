import { describe, expect, it } from "vitest";
import { computeHazardVelocities } from "./hazardVelocity";

describe("computeHazardVelocities", () => {
  it("returns 0/0 for a hazard with no previous position", () => {
    const result = computeHazardVelocities([{ id: "a", x: 100, y: 50 }], new Map(), 33);
    expect(result.get("a")).toEqual({ vx: 0, vy: 0 });
  });

  it("computes velocity as pixel delta over time delta (px/s)", () => {
    const previous = new Map([["a", { x: 90, y: 50 }]]);
    // 10px in 33ms unterwegs -> ~303 px/s
    const result = computeHazardVelocities([{ id: "a", x: 100, y: 50 }], previous, 33);
    const velocity = result.get("a");
    expect(velocity).toBeDefined();
    expect(velocity?.vx).toBeCloseTo((10 / 33) * 1000, 0);
    expect(velocity?.vy).toBe(0);
  });

  it("returns 0/0 when deltaMs is 0 (avoid division by zero)", () => {
    const previous = new Map([["a", { x: 90, y: 50 }]]);
    const result = computeHazardVelocities([{ id: "a", x: 100, y: 50 }], previous, 0);
    expect(result.get("a")).toEqual({ vx: 0, vy: 0 });
  });

  it("handles multiple hazards independently", () => {
    const previous = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 100, y: 100 }],
    ]);
    const result = computeHazardVelocities(
      [
        { id: "a", x: 10, y: 0 },
        { id: "b", x: 100, y: 90 },
      ],
      previous,
      1000
    );
    expect(result.get("a")).toEqual({ vx: 10, vy: 0 });
    expect(result.get("b")).toEqual({ vx: 0, vy: -10 });
  });
});
