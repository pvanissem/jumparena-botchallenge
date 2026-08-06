import { describe, expect, it } from "vitest";
import { VIEW_RADIUS_PX, withinViewRadius } from "./viewport";

describe("withinViewRadius", () => {
  it("includes objects inside the radius", () => {
    expect(withinViewRadius(100, 0)).toBe(true);
    expect(withinViewRadius(0, 100)).toBe(true);
    expect(withinViewRadius(100, 100)).toBe(true);
  });

  it("includes objects exactly on the radius boundary", () => {
    expect(withinViewRadius(VIEW_RADIUS_PX, 0)).toBe(true);
    expect(withinViewRadius(0, VIEW_RADIUS_PX)).toBe(true);
  });

  it("excludes objects beyond the radius", () => {
    expect(withinViewRadius(VIEW_RADIUS_PX + 1, 0)).toBe(false);
    expect(withinViewRadius(VIEW_RADIUS_PX, VIEW_RADIUS_PX)).toBe(false);
  });

  it("respects a custom radius argument", () => {
    expect(withinViewRadius(50, 0, 40)).toBe(false);
    expect(withinViewRadius(30, 0, 40)).toBe(true);
  });
});
