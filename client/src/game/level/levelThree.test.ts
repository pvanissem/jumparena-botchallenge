import { describe, expect, it } from "vitest";
import { LEVEL_THREE } from "./levelThree";

describe("LEVEL_THREE structure", () => {
  it("has 10-15 visible coins (docs/06)", () => {
    expect(LEVEL_THREE.coins.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_THREE.coins.length).toBeLessThanOrEqual(15);
  });

  it("has 3-5 hidden coin blocks (docs/06)", () => {
    expect(LEVEL_THREE.hiddenCoinBlocks.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_THREE.hiddenCoinBlocks.length).toBeLessThanOrEqual(5);
  });

  it("has at least 3 checkpoints", () => {
    expect(LEVEL_THREE.checkpoints.length).toBeGreaterThanOrEqual(3);
  });

  it("only uses existing hazard kinds (no new hazard type)", () => {
    const kinds = new Set(LEVEL_THREE.hazards.map((h) => h.kind));
    for (const kind of kinds) {
      expect(["schnetzler", "ninjafrog", "stachlinger", "loderix", "kugelblitz", "spikehead"]).toContain(
        kind
      );
    }
  });

  it("uses the night background and terrain style", () => {
    expect(LEVEL_THREE.backgroundKey).toBe("night");
    expect(LEVEL_THREE.terrainStyleKey).toBe("night");
  });

  it("has unique ids across coins, hidden blocks, checkpoints, hazards and utilities", () => {
    const ids = [
      ...LEVEL_THREE.coins.map((c) => c.id),
      ...LEVEL_THREE.hiddenCoinBlocks.map((b) => b.id),
      ...LEVEL_THREE.checkpoints.map((c) => c.id),
      ...LEVEL_THREE.hazards.map((h) => h.id),
      ...LEVEL_THREE.utilities.map((u) => u.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a world width in a similar order of magnitude as LEVEL_ONE/TWO (2400-3000px)", () => {
    expect(LEVEL_THREE.worldWidth).toBeGreaterThanOrEqual(2400);
    expect(LEVEL_THREE.worldWidth).toBeLessThanOrEqual(3000);
  });
});

describe("LEVEL_THREE difficulty - easier than LEVEL_TWO", () => {
  function platformContains(platform: { x: number; tilesWide: number }, x: number): boolean {
    return x >= platform.x && x <= platform.x + platform.tilesWide * 16;
  }

  function isOverAnyPlatform(x: number): boolean {
    return LEVEL_THREE.platforms.some((p) => platformContains(p, x));
  }

  it("keeps every ground gap at or below LEVEL_ONE's 128px (comfortable jumps)", () => {
    const groundPlatforms = LEVEL_THREE.platforms
      .filter((p) => p.kind !== "float")
      .slice()
      .sort((a, b) => a.x - b.x);

    for (let i = 1; i < groundPlatforms.length; i++) {
      const prev = groundPlatforms[i - 1];
      const curr = groundPlatforms[i];
      const gap = curr.x - (prev.x + prev.tilesWide * 16);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(128);
    }
  });

  it("has no schnetzler gauntlet cluster (>=3 on one platform, unlike LEVEL_TWO)", () => {
    const groundPlatforms = LEVEL_THREE.platforms.filter((p) => p.kind !== "float");
    const hasCluster = groundPlatforms.some((platform) => {
      const schnetzlerOnPlatform = LEVEL_THREE.hazards.filter(
        (h) =>
          h.kind === "schnetzler" &&
          platformContains(platform, h.minX) &&
          platformContains(platform, h.maxX)
      );
      return schnetzlerOnPlatform.length >= 3;
    });
    expect(hasCluster).toBe(false);
  });

  it("keeps every schnetzler patrol speed at or below LEVEL_TWO's slowest gauntlet speed (70)", () => {
    for (const hazard of LEVEL_THREE.hazards) {
      if (hazard.kind !== "schnetzler") continue;
      expect(hazard.speed).toBeLessThanOrEqual(70);
    }
  });

  it("gives every spikehead an easier timing than LEVEL_TWO's defaults (warnMs>400, restMs<600)", () => {
    for (const hazard of LEVEL_THREE.hazards) {
      if (hazard.kind !== "spikehead") continue;
      expect(hazard.warnMs ?? 400).toBeGreaterThan(400);
      expect(hazard.restMs ?? 600).toBeLessThan(600);
    }
  });

  it("does not use the kugelblitz hazard (deliberately omitted for an easier level)", () => {
    expect(LEVEL_THREE.hazards.some((h) => h.kind === "kugelblitz")).toBe(false);
  });

  it("places every coin, hidden block, checkpoint and utility above a platform", () => {
    for (const coin of LEVEL_THREE.coins) {
      expect(isOverAnyPlatform(coin.x), `${coin.id} has no platform beneath it`).toBe(true);
    }
    for (const block of LEVEL_THREE.hiddenCoinBlocks) {
      expect(isOverAnyPlatform(block.x), `${block.id} has no platform beneath it`).toBe(true);
    }
    for (const checkpoint of LEVEL_THREE.checkpoints) {
      expect(isOverAnyPlatform(checkpoint.x), `${checkpoint.id} has no platform beneath it`).toBe(
        true
      );
    }
    for (const utility of LEVEL_THREE.utilities) {
      expect(isOverAnyPlatform(utility.x), `${utility.id} has no platform beneath it`).toBe(true);
    }
  });
});
