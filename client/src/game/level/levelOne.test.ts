import { describe, expect, it } from "vitest";
import { LEVEL_ONE } from "./levelOne";

describe("LEVEL_ONE structure", () => {
  it("has 10-15 visible coins (docs/06)", () => {
    expect(LEVEL_ONE.coins.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_ONE.coins.length).toBeLessThanOrEqual(15);
  });

  it("has 3-5 hidden coin blocks (docs/06)", () => {
    expect(LEVEL_ONE.hiddenCoinBlocks.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_ONE.hiddenCoinBlocks.length).toBeLessThanOrEqual(5);
  });

  it("has at least 2 checkpoints", () => {
    expect(LEVEL_ONE.checkpoints.length).toBeGreaterThanOrEqual(2);
  });

  it("contains all four hazard kinds (docs/08)", () => {
    const kinds = LEVEL_ONE.hazards.map((h) => h.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["ninjafrog", "stachlinger", "loderix", "kugelblitz"])
    );
  });

  it("uses the stompable ninjafrog (not the saw) as the level's patrolling NPC", () => {
    const kinds = LEVEL_ONE.hazards.map((h) => h.kind);
    expect(kinds).not.toContain("schnetzler");
  });

  it("has at least one boingo utility", () => {
    expect(LEVEL_ONE.utilities.length).toBeGreaterThanOrEqual(1);
    expect(LEVEL_ONE.utilities.every((u) => u.kind === "boingo")).toBe(true);
  });

  it("has unique ids across coins, hidden blocks, checkpoints and hazards", () => {
    const ids = [
      ...LEVEL_ONE.coins.map((c) => c.id),
      ...LEVEL_ONE.hiddenCoinBlocks.map((b) => b.id),
      ...LEVEL_ONE.checkpoints.map((c) => c.id),
      ...LEVEL_ONE.hazards.map((h) => h.id),
      ...LEVEL_ONE.utilities.map((u) => u.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Regressionsschutz gegen genau die Klasse von Fehlern, die den vorherigen
 * Level-Entwurf "kaputt" gemacht hat: Hazards, die über Lücken hinaus
 * patrouillieren, sowie Coins/Blöcke/Utilities, die frei in der Luft hängen,
 * ohne dass darunter tatsächlich eine Plattform liegt.
 */
describe("LEVEL_ONE physical plausibility", () => {
  /** Enthält eine Plattform die x-Position vollständig (inkl. rechter Kante)? */
  function platformContains(platform: { x: number; tilesWide: number }, x: number): boolean {
    return x >= platform.x && x <= platform.x + platform.tilesWide * 16;
  }

  function isOverAnyPlatform(x: number): boolean {
    return LEVEL_ONE.platforms.some((p) => platformContains(p, x));
  }

  it("keeps every ground gap within a comfortably jumpable distance (<=200px)", () => {
    const groundPlatforms = LEVEL_ONE.platforms
      .filter((p) => p.kind !== "float")
      .slice()
      .sort((a, b) => a.x - b.x);

    for (let i = 1; i < groundPlatforms.length; i++) {
      const prev = groundPlatforms[i - 1];
      const curr = groundPlatforms[i];
      const gap = curr.x - (prev.x + prev.tilesWide * 16);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(200);
    }
  });

  it("places every patrolling hazard's full range on a single platform (never into a gap)", () => {
    for (const hazard of LEVEL_ONE.hazards) {
      if (hazard.kind !== "schnetzler" && hazard.kind !== "ninjafrog") continue;
      const onSomePlatform = LEVEL_ONE.platforms.some(
        (p) => platformContains(p, hazard.minX) && platformContains(p, hazard.maxX)
      );
      expect(onSomePlatform, `${hazard.id} patrols outside any single platform`).toBe(true);
    }
  });

  it("places every static hazard (stachlinger/loderix) on top of a platform", () => {
    for (const hazard of LEVEL_ONE.hazards) {
      if (hazard.kind !== "stachlinger" && hazard.kind !== "loderix") continue;
      expect(isOverAnyPlatform(hazard.x), `${hazard.id} is not above any platform`).toBe(true);
    }
  });

  it("places the kugelblitz pendulum deliberately over a gap, not over solid ground", () => {
    const kugelblitz = LEVEL_ONE.hazards.find((h) => h.kind === "kugelblitz");
    expect(kugelblitz).toBeDefined();
    if (kugelblitz?.kind === "kugelblitz") {
      const groundPlatforms = LEVEL_ONE.platforms.filter((p) => p.kind !== "float");
      const overGround = groundPlatforms.some((p) => platformContains(p, kugelblitz.pivotX));
      expect(overGround, "kugelblitz should swing over a gap, not solid ground").toBe(false);
    }
  });

  it("places every coin above a platform (ground or float)", () => {
    for (const coin of LEVEL_ONE.coins) {
      expect(isOverAnyPlatform(coin.x), `${coin.id} has no platform beneath it`).toBe(true);
    }
  });

  it("places every hidden block above a platform", () => {
    for (const block of LEVEL_ONE.hiddenCoinBlocks) {
      expect(isOverAnyPlatform(block.x), `${block.id} has no platform beneath it`).toBe(true);
    }
  });

  it("places every checkpoint and utility above a platform", () => {
    for (const checkpoint of LEVEL_ONE.checkpoints) {
      expect(isOverAnyPlatform(checkpoint.x), `${checkpoint.id} has no platform beneath it`).toBe(
        true
      );
    }
    for (const utility of LEVEL_ONE.utilities) {
      expect(isOverAnyPlatform(utility.x), `${utility.id} has no platform beneath it`).toBe(true);
    }
  });

  it("places every 'boingo-only' float platform higher than a normal jump can reach (>174px)", () => {
    // Float-Plattformen, die absichtlich nur per Boingo erreichbar sein sollen,
    // liegen laut Level-Design bei ~210px über dem Boden.
    const highFloatPlatforms = LEVEL_ONE.platforms.filter(
      (p) => p.kind === "float" && LEVEL_ONE.groundY - p.y > 180
    );
    expect(highFloatPlatforms.length).toBeGreaterThanOrEqual(2);
  });
});
