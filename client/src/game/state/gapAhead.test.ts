import { describe, expect, it } from "vitest";
import type { LevelDef, PlatformDef } from "../level/types";
import { computeGapAhead } from "./gapAhead";

const TILE = 16;

/** Level mit einem durchgehenden Bodensegment über [startCol, endCol] auf Zeile
 *  `groundRow` (Plattform-Row). Bot steht typischerweise eine Zeile darüber. */
function levelWithGround(startCol: number, endCol: number, groundRow: number): LevelDef {
  const platform: PlatformDef = {
    x: startCol * TILE,
    y: groundRow * TILE,
    tilesWide: endCol - startCol + 1,
  };
  return {
    worldWidth: 4000,
    worldHeight: 540,
    groundY: groundRow * TILE,
    spawn: { x: 0, y: 0 },
    goal: { x: 3000, y: 0 },
    platforms: [platform],
    coins: [],
    hiddenCoinBlocks: [],
    checkpoints: [],
    hazards: [],
    utilities: [],
  };
}

describe("computeGapAhead", () => {
  // Boden auf Zeile 20 über die Spalten 0..9 (also bis x=159). Bot auf Zeile 19.
  const level = levelWithGround(0, 9, 20);
  const botY = 19 * TILE; // eine Zeile über dem Boden -> Bodenzeile darunter = 20

  it("reports no gap when solid ground continues ahead (right)", () => {
    // Bot bei col 2, Boden reicht bis col 9 (> radius nicht nötig) -> kein Gap in Reichweite
    const gap = computeGapAhead(level, 2 * TILE, botY, "right", 64);
    expect(gap).toEqual({ present: false, distance: null });
  });

  it("detects a gap ahead to the right and reports the distance to its edge", () => {
    // Bot bei col 7 (x=112). Boden endet nach col 9 -> erste Lücke bei col 10 (x=160).
    const gap = computeGapAhead(level, 7 * TILE, botY, "right", 320);
    expect(gap.present).toBe(true);
    expect(gap.distance).toBe(10 * TILE - 7 * TILE); // 48px bis zur Lückenkante
  });

  it("detects a gap ahead to the left", () => {
    // Boden über col 5..9. Bot bei col 6. Links: erste Lücke bei col 4.
    const leftLevel = levelWithGround(5, 9, 20);
    const gap = computeGapAhead(leftLevel, 6 * TILE, botY, "left", 320);
    expect(gap.present).toBe(true);
    expect(gap.distance).toBe(6 * TILE - (4 * TILE + TILE - 1)); // bis rechte Kante des Lücken-Tiles
  });

  it("reports no gap when the gap is beyond maxDistancePx", () => {
    // Lücke ab col 10 (x=160). Bot bei col 2 (x=32). Distanz 128px > maxDistance 64.
    const gap = computeGapAhead(level, 2 * TILE, botY, "right", 64);
    expect(gap).toEqual({ present: false, distance: null });
  });

  it("reports a gap immediately when the bot already has no ground under it", () => {
    // Bot rechts vom Boden (col 12), kein Boden darunter -> Gap bei distance 0.
    const gap = computeGapAhead(level, 12 * TILE, botY, "right", 320);
    expect(gap.present).toBe(true);
    expect(gap.distance).toBe(0);
  });

  it("scans up to the horizontal view range by default", () => {
    // Boden über col 0..24 (400px), Lücke ab col 25 (x=400). Bot bei col 0.
    const wide = levelWithGround(0, 24, 20);
    expect(computeGapAhead(wide, 0, botY, "right").distance).toBe(25 * TILE);

    // Eine Spalte weiter draußen liegt jenseits von VIEW_HALF_WIDTH_PX.
    const wider = levelWithGround(0, 25, 20);
    expect(computeGapAhead(wider, 0, botY, "right")).toEqual({
      present: false,
      distance: null,
    });
  });
});
