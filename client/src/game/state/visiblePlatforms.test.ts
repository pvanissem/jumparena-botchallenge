import { describe, expect, it } from "vitest";
import type { LevelDef } from "../level/types";
import { VIEW_RADIUS_PX } from "./viewport";
import { buildVisiblePlatforms } from "./visiblePlatforms";

function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    worldWidth: 2000,
    worldHeight: 400,
    groundY: 200,
    spawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    platforms: [],
    coins: [],
    hiddenCoinBlocks: [],
    checkpoints: [],
    hazards: [],
    utilities: [],
    ...overrides,
  };
}

describe("buildVisiblePlatforms", () => {
  it("includes a platform inside the view radius with dx/dy relative to the bot", () => {
    const level = makeLevel({ platforms: [{ x: 0, y: 160, tilesWide: 4 }] });
    const result = buildVisiblePlatforms(level, new Set(), 32, 100);

    expect(result).toEqual([{ dx: -32, dy: 60, width: 64, height: 16, kind: "ground" }]);
  });

  it("uses the platform's exact collider top edge (NOT the snapped tile row)", () => {
    // Der StaticBody in `worldBuilder` sitzt bei y + TILE_SIZE/2 mit Hoehe
    // TILE_SIZE -> Oberkante exakt bei platform.y. Ein Runden auf die
    // Tile-Zeile (496 statt 500) waere 4px daneben.
    const level = makeLevel({ platforms: [{ x: 0, y: 500, tilesWide: 1 }] });
    const result = buildVisiblePlatforms(level, new Set(), 0, 490);
    expect(result[0].dy).toBe(10); // 500 - 490, NICHT 496 - 490 = 6
  });

  it("defaults kind to 'ground' when omitted", () => {
    const level = makeLevel({ platforms: [{ x: 0, y: 0, tilesWide: 1 }] });
    const result = buildVisiblePlatforms(level, new Set(), 0, 0);
    expect(result[0].kind).toBe("ground");
  });

  it("passes through an explicit kind (e.g. 'ceiling')", () => {
    const level = makeLevel({ platforms: [{ x: 0, y: 0, tilesWide: 1, kind: "ceiling" }] });
    const result = buildVisiblePlatforms(level, new Set(), 0, 0);
    expect(result[0].kind).toBe("ceiling");
  });

  it("excludes a platform entirely outside the view radius", () => {
    const level = makeLevel({
      platforms: [{ x: VIEW_RADIUS_PX * 3, y: 0, tilesWide: 1 }],
    });
    const result = buildVisiblePlatforms(level, new Set(), 0, 0);
    expect(result).toEqual([]);
  });

  it("does NOT clip a large platform that merely intersects the view radius", () => {
    // Plattform beginnt weit außerhalb, ragt aber in den Sichtradius hinein.
    const level = makeLevel({
      platforms: [{ x: -10000, y: 0, tilesWide: 2000 }], // 32000px breit
    });
    const result = buildVisiblePlatforms(level, new Set(), 0, VIEW_RADIUS_PX - 1);
    expect(result).toHaveLength(1);
    expect(result[0].width).toBe(2000 * 16);
  });

  it("includes an unresolved hidden coin block as kind 'block' with its collider size", () => {
    const level = makeLevel({
      hiddenCoinBlocks: [{ id: "b1", x: 100, y: 100, fruit: "kiwi" }],
    });
    const result = buildVisiblePlatforms(level, new Set(), 100, 100);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("block");
    // 28*1.2 x 24*1.2, zentriert auf (100,100)
    expect(result[0].width).toBeCloseTo(33.6);
    expect(result[0].height).toBeCloseTo(28.8);
    expect(result[0].dx).toBeCloseTo(-16.8);
    expect(result[0].dy).toBeCloseTo(-14.4);
  });

  it("excludes an already-resolved hidden coin block", () => {
    const level = makeLevel({
      hiddenCoinBlocks: [{ id: "b1", x: 100, y: 100, fruit: "kiwi" }],
    });
    const result = buildVisiblePlatforms(level, new Set(["b1"]), 100, 100);
    expect(result).toEqual([]);
  });

  it("returns an empty array when nothing is visible", () => {
    const level = makeLevel();
    expect(buildVisiblePlatforms(level, new Set(), 0, 0)).toEqual([]);
  });
});
