import { describe, expect, it } from "vitest";
import { VIEW_HALF_HEIGHT_PX, VIEW_HALF_WIDTH_PX, withinView } from "./viewport";

describe("withinView", () => {
  it("includes objects inside the view rectangle", () => {
    expect(withinView(100, 0)).toBe(true);
    expect(withinView(0, 100)).toBe(true);
    expect(withinView(100, 100)).toBe(true);
    expect(withinView(-350, -400)).toBe(true);
  });

  it("includes objects exactly on the boundary", () => {
    expect(withinView(VIEW_HALF_WIDTH_PX, 0)).toBe(true);
    expect(withinView(-VIEW_HALF_WIDTH_PX, 0)).toBe(true);
    expect(withinView(0, VIEW_HALF_HEIGHT_PX)).toBe(true);
    expect(withinView(0, -VIEW_HALF_HEIGHT_PX)).toBe(true);
    // Ecke: beim Rechteck (anders als beim früheren Kreis) sichtbar.
    expect(withinView(VIEW_HALF_WIDTH_PX, VIEW_HALF_HEIGHT_PX)).toBe(true);
  });

  it("excludes objects beyond the horizontal half width", () => {
    expect(withinView(VIEW_HALF_WIDTH_PX + 1, 0)).toBe(false);
    expect(withinView(-(VIEW_HALF_WIDTH_PX + 1), 0)).toBe(false);
  });

  it("excludes objects beyond the vertical half height", () => {
    expect(withinView(0, VIEW_HALF_HEIGHT_PX + 1)).toBe(false);
    expect(withinView(0, -(VIEW_HALF_HEIGHT_PX + 1))).toBe(false);
  });

  it("sees the full level height, since the camera never scrolls vertically", () => {
    // Kern des Fixes: ein Bot auf einer hohen Plattform muss den Boden weit
    // unter sich sehen. Alle Level haben worldHeight 540 -> jedes vertikale
    // Delta innerhalb des Levels liegt im Sichtfeld.
    expect(VIEW_HALF_HEIGHT_PX).toBeGreaterThanOrEqual(540);
    expect(withinView(0, 500)).toBe(true);
    expect(withinView(0, -500)).toBe(true);
    expect(withinView(200, 480)).toBe(true);
  });

  it("matches the camera viewport horizontally (half of the 800px canvas)", () => {
    expect(VIEW_HALF_WIDTH_PX).toBe(400);
  });

  it("respects custom half extents", () => {
    expect(withinView(50, 0, 40, 40)).toBe(false);
    expect(withinView(30, 0, 40, 40)).toBe(true);
    expect(withinView(0, 50, 40, 40)).toBe(false);
  });
});
