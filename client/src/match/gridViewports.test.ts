import { describe, expect, it } from "vitest";
import { computeGridViewports } from "./gridViewports";

describe("computeGridViewports", () => {
  const WIDTH = 800;
  const HEIGHT = 600;

  it("returns an empty array for zero participants", () => {
    expect(computeGridViewports(0, WIDTH, HEIGHT)).toEqual([]);
  });

  it("uses the full canvas for one participant", () => {
    expect(computeGridViewports(1, WIDTH, HEIGHT)).toEqual([
      { x: 0, y: 0, width: 800, height: 600 },
    ]);
  });

  it("splits two participants side by side", () => {
    expect(computeGridViewports(2, WIDTH, HEIGHT)).toEqual([
      { x: 0, y: 0, width: 400, height: 600 },
      { x: 400, y: 0, width: 400, height: 600 },
    ]);
  });

  it("uses a 2x2 grid for three participants", () => {
    expect(computeGridViewports(3, WIDTH, HEIGHT)).toEqual([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 400, y: 0, width: 400, height: 300 },
      { x: 0, y: 300, width: 400, height: 300 },
    ]);
  });

  it("uses a 2x2 grid for four participants", () => {
    expect(computeGridViewports(4, WIDTH, HEIGHT)).toEqual([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 400, y: 0, width: 400, height: 300 },
      { x: 0, y: 300, width: 400, height: 300 },
      { x: 400, y: 300, width: 400, height: 300 },
    ]);
  });

  it("covers the whole canvas without overlap for full layouts", () => {
    for (const count of [1, 2, 4]) {
      const rects = computeGridViewports(count, WIDTH, HEIGHT);
      const totalArea = rects.reduce((sum, r) => sum + r.width * r.height, 0);
      expect(totalArea).toBe(WIDTH * HEIGHT);
    }
  });

  it("keeps all viewports within the canvas bounds", () => {
    for (const count of [1, 2, 3, 4]) {
      const rects = computeGridViewports(count, WIDTH, HEIGHT);

      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(WIDTH);
        expect(r.y + r.height).toBeLessThanOrEqual(HEIGHT);
      }
    }
  });
});
