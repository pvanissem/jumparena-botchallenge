import { describe, expect, it } from "vitest";
import { LEVEL_TWO } from "./levelTwo";

describe("LEVEL_TWO structure", () => {
  it("has 10-15 visible coins (docs/06)", () => {
    expect(LEVEL_TWO.coins.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_TWO.coins.length).toBeLessThanOrEqual(15);
  });

  it("has 3-5 hidden coin blocks (docs/06)", () => {
    expect(LEVEL_TWO.hiddenCoinBlocks.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_TWO.hiddenCoinBlocks.length).toBeLessThanOrEqual(5);
  });

  it("has at least 3 checkpoints (similarly dense as LEVEL_ONE)", () => {
    expect(LEVEL_TWO.checkpoints.length).toBeGreaterThanOrEqual(3);
  });

  it("contains all five hazard kinds, including the new spikehead", () => {
    const kinds = LEVEL_TWO.hazards.map((h) => h.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["ninjafrog", "stachlinger", "loderix", "kugelblitz", "spikehead"])
    );
  });

  it("has at least one boingo utility", () => {
    expect(LEVEL_TWO.utilities.length).toBeGreaterThanOrEqual(1);
    expect(LEVEL_TWO.utilities.every((u) => u.kind === "boingo")).toBe(true);
  });

  it("has unique ids across coins, hidden blocks, checkpoints and hazards", () => {
    const ids = [
      ...LEVEL_TWO.coins.map((c) => c.id),
      ...LEVEL_TWO.hiddenCoinBlocks.map((b) => b.id),
      ...LEVEL_TWO.checkpoints.map((c) => c.id),
      ...LEVEL_TWO.hazards.map((h) => h.id),
      ...LEVEL_TWO.utilities.map((u) => u.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a world width in a similar order of magnitude as LEVEL_ONE (~3000-3600px)", () => {
    expect(LEVEL_TWO.worldWidth).toBeGreaterThanOrEqual(3000);
    expect(LEVEL_TWO.worldWidth).toBeLessThanOrEqual(3600);
  });
});

describe("LEVEL_TWO physical plausibility", () => {
  function platformContains(platform: { x: number; tilesWide: number }, x: number): boolean {
    return x >= platform.x && x <= platform.x + platform.tilesWide * 16;
  }

  function isOverAnyPlatform(x: number): boolean {
    return LEVEL_TWO.platforms.some((p) => platformContains(p, x));
  }

  it("keeps every ground gap within a comfortably jumpable distance (<=230px)", () => {
    const groundPlatforms = LEVEL_TWO.platforms
      .filter((p) => p.kind !== "float")
      .slice()
      .sort((a, b) => a.x - b.x);

    for (let i = 1; i < groundPlatforms.length; i++) {
      const prev = groundPlatforms[i - 1];
      const curr = groundPlatforms[i];
      const gap = curr.x - (prev.x + prev.tilesWide * 16);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(230);
    }
  });

  it("has at least one gap noticeably wider than LEVEL_ONE's 128px (>150px)", () => {
    const groundPlatforms = LEVEL_TWO.platforms
      .filter((p) => p.kind !== "float")
      .slice()
      .sort((a, b) => a.x - b.x);

    const gaps: number[] = [];
    for (let i = 1; i < groundPlatforms.length; i++) {
      const prev = groundPlatforms[i - 1];
      const curr = groundPlatforms[i];
      gaps.push(curr.x - (prev.x + prev.tilesWide * 16));
    }
    expect(gaps.some((g) => g > 150)).toBe(true);
  });

  it("has at least one platform with a cluster of >=3 ninjafrog on it (gauntlet)", () => {
    const groundPlatforms = LEVEL_TWO.platforms.filter((p) => p.kind !== "float");
    const hasCluster = groundPlatforms.some((platform) => {
      const ninjafrogOnPlatform = LEVEL_TWO.hazards.filter(
        (h) =>
          h.kind === "ninjafrog" &&
          platformContains(platform, h.minX) &&
          platformContains(platform, h.maxX)
      );
      return ninjafrogOnPlatform.length >= 3;
    });
    expect(hasCluster).toBe(true);
  });

  it("places every spikehead's trigger zone and origin above solid ground (not a gap)", () => {
    for (const hazard of LEVEL_TWO.hazards) {
      if (hazard.kind !== "spikehead") continue;
      expect(isOverAnyPlatform(hazard.x), `${hazard.id} is not above any platform`).toBe(true);
      expect(hazard.triggerMinX).toBeLessThan(hazard.triggerMaxX);
    }
  });

  it("has at least one spikehead hazard", () => {
    expect(LEVEL_TWO.hazards.some((h) => h.kind === "spikehead")).toBe(true);
  });

  it("places every coin above a platform (ground or float)", () => {
    for (const coin of LEVEL_TWO.coins) {
      expect(isOverAnyPlatform(coin.x), `${coin.id} has no platform beneath it`).toBe(true);
    }
  });

  it("places every hidden block above a platform", () => {
    for (const block of LEVEL_TWO.hiddenCoinBlocks) {
      expect(isOverAnyPlatform(block.x), `${block.id} has no platform beneath it`).toBe(true);
    }
  });

  it("places every checkpoint and utility above a platform", () => {
    for (const checkpoint of LEVEL_TWO.checkpoints) {
      expect(isOverAnyPlatform(checkpoint.x), `${checkpoint.id} has no platform beneath it`).toBe(
        true
      );
    }
    for (const utility of LEVEL_TWO.utilities) {
      expect(isOverAnyPlatform(utility.x), `${utility.id} has no platform beneath it`).toBe(true);
    }
  });
});
