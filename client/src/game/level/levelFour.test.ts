import { describe, expect, it } from "vitest";
import { CEILING_CLEARANCE, GROUND_Y, LEVEL_FOUR } from "./levelFour";

describe("LEVEL_FOUR structure", () => {
  it("has 10-15 visible coins (docs/06)", () => {
    expect(LEVEL_FOUR.coins.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_FOUR.coins.length).toBeLessThanOrEqual(15);
  });

  it("has 3-5 hidden coin blocks (docs/06)", () => {
    expect(LEVEL_FOUR.hiddenCoinBlocks.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_FOUR.hiddenCoinBlocks.length).toBeLessThanOrEqual(5);
  });

  it("has at least 3 checkpoints", () => {
    expect(LEVEL_FOUR.checkpoints.length).toBeGreaterThanOrEqual(3);
  });

  it("only uses existing hazard kinds (no new hazard type)", () => {
    const kinds = new Set(LEVEL_FOUR.hazards.map((h) => h.kind));
    for (const kind of kinds) {
      expect([
        "schnetzler",
        "ninjafrog",
        "stachlinger",
        "loderix",
        "kugelblitz",
        "spikehead",
      ]).toContain(kind);
    }
  });

  it("uses the underground background and terrain style", () => {
    expect(LEVEL_FOUR.backgroundKey).toBe("underground");
    expect(LEVEL_FOUR.terrainStyleKey).toBe("underground");
  });

  it("has unique ids across coins, hidden blocks, checkpoints, hazards and utilities", () => {
    const ids = [
      ...LEVEL_FOUR.coins.map((c) => c.id),
      ...LEVEL_FOUR.hiddenCoinBlocks.map((b) => b.id),
      ...LEVEL_FOUR.checkpoints.map((c) => c.id),
      ...LEVEL_FOUR.hazards.map((h) => h.id),
      ...LEVEL_FOUR.utilities.map((u) => u.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a world width in a similar order of magnitude as LEVEL_ONE/TWO/THREE (2400-3000px)", () => {
    expect(LEVEL_FOUR.worldWidth).toBeGreaterThanOrEqual(2400);
    expect(LEVEL_FOUR.worldWidth).toBeLessThanOrEqual(3000);
  });
});

describe("LEVEL_FOUR - closed corridor (floor AND ceiling)", () => {
  function groundSegments() {
    return LEVEL_FOUR.platforms.filter((p) => (p.kind ?? "ground") === "ground");
  }
  function ceilingSegments() {
    return LEVEL_FOUR.platforms.filter((p) => p.kind === "ceiling");
  }

  it("gives every ground segment a matching ceiling segment (same x/tilesWide)", () => {
    const grounds = groundSegments();
    const ceilings = ceilingSegments();
    expect(ceilings.length).toBe(grounds.length);
    for (const ground of grounds) {
      const match = ceilings.find((c) => c.x === ground.x && c.tilesWide === ground.tilesWide);
      expect(match, `no ceiling segment matches ground at x=${ground.x}`).toBeDefined();
    }
  });

  it("places every ceiling segment at a consistent corridor height", () => {
    for (const ceiling of ceilingSegments()) {
      expect(ceiling.y).toBe(GROUND_Y - CEILING_CLEARANCE);
    }
  });

  it("keeps the corridor clearance comfortably above max jump height + player height (>=200px)", () => {
    expect(CEILING_CLEARANCE).toBeGreaterThanOrEqual(200);
  });
});

describe("LEVEL_FOUR - comfortable gaps (thematic, not a difficulty spike)", () => {
  it("keeps every ground gap at or below LEVEL_TWO's easiest gap (170px)", () => {
    const groundPlatforms = LEVEL_FOUR.platforms
      .filter((p) => (p.kind ?? "ground") === "ground")
      .slice()
      .sort((a, b) => a.x - b.x);

    for (let i = 1; i < groundPlatforms.length; i++) {
      const prev = groundPlatforms[i - 1];
      const curr = groundPlatforms[i];
      const gap = curr.x - (prev.x + prev.tilesWide * 16);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(170);
    }
  });

  it("places every coin, hidden block, checkpoint and utility above a ground platform", () => {
    function platformContains(platform: { x: number; tilesWide: number }, x: number): boolean {
      return x >= platform.x && x <= platform.x + platform.tilesWide * 16;
    }
    function isOverAnyGround(x: number): boolean {
      return LEVEL_FOUR.platforms
        .filter((p) => (p.kind ?? "ground") === "ground")
        .some((p) => platformContains(p, x));
    }

    for (const coin of LEVEL_FOUR.coins) {
      expect(isOverAnyGround(coin.x), `${coin.id} has no ground platform beneath it`).toBe(true);
    }
    for (const block of LEVEL_FOUR.hiddenCoinBlocks) {
      expect(isOverAnyGround(block.x), `${block.id} has no ground platform beneath it`).toBe(true);
    }
    for (const checkpoint of LEVEL_FOUR.checkpoints) {
      expect(
        isOverAnyGround(checkpoint.x),
        `${checkpoint.id} has no ground platform beneath it`
      ).toBe(true);
    }
    for (const utility of LEVEL_FOUR.utilities) {
      expect(isOverAnyGround(utility.x), `${utility.id} has no ground platform beneath it`).toBe(
        true
      );
    }
  });
});
