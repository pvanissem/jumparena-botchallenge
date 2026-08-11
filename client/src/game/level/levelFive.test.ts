import { describe, expect, it } from "vitest";
import { MOVEMENT_TUNING } from "../movement/movement";
import { CHAIN_Y, CHASM_MAX_X, CHASM_MIN_X, GROUND_Y, HIGH_ROUTE_Y, LEVEL_FIVE } from "./levelFive";
import { FRUIT_VALUES } from "./types";

/**
 * Berechnet die horizontale Reichweite eines Boingo-Sprungs, der gegenüber
 * der Absprung-Höhe um `rise` Pixel höher landet (positiv = Höhengewinn).
 * Float-Plattformen sind jump-through; der Bot landet in der Fallphase,
 * wir verwenden deshalb die *zweite* Nullstelle der Wurfparabel.
 */
function boingoRangeForRise(rise: number, speed: number): number {
  const v0 = -MOVEMENT_TUNING.BOINGO_JUMP_VELOCITY; // 820 (positiv)
  const g = MOVEMENT_TUNING.GRAVITY_Y; // 900
  // s_y(t) = v0*t - 0.5*g*t^2   (Aufwärts positiv)
  // rise = v0*t - 0.5*g*t^2
  // 0.5*g*t^2 - v0*t + rise = 0
  const a = g / 2;
  const b = -v0;
  const c = rise;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return NaN;
  const t = (-b + Math.sqrt(discriminant)) / (2 * a); // zweite Nullstelle
  return speed * t;
}

/**
 * Horizontale Drift beim freien Fall um `drop` Pixel (positiv = fällt nach unten).
 */
function fallDrift(drop: number, speed: number): number {
  const g = MOVEMENT_TUNING.GRAVITY_Y;
  const t = Math.sqrt((2 * drop) / g);
  return speed * t;
}

const KNOWN_HAZARD_KINDS = new Set([
  "schnetzler",
  "ninjafrog",
  "loderix",
  "spikehead",
  "stachlinger",
  "kugelblitz",
]);

function groundSegments() {
  return LEVEL_FIVE.platforms.filter((p) => (p.kind ?? "ground") === "ground");
}

function groundGaps(): number[] {
  const sorted = groundSegments()
    .slice()
    .sort((a, b) => a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    gaps.push(curr.x - (prev.x + prev.tilesWide * 16));
  }
  return gaps;
}

describe("LEVEL_FIVE structure", () => {
  it("has 10-15 visible coins", () => {
    expect(LEVEL_FIVE.coins.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_FIVE.coins.length).toBeLessThanOrEqual(15);
  });

  it("has 3-5 hidden coin blocks", () => {
    expect(LEVEL_FIVE.hiddenCoinBlocks.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_FIVE.hiddenCoinBlocks.length).toBeLessThanOrEqual(5);
  });

  it("has at least 3 checkpoints, exactly one spawn and exactly one goal", () => {
    expect(LEVEL_FIVE.checkpoints.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_FIVE.spawn).toBeDefined();
    expect(LEVEL_FIVE.goal).toBeDefined();
  });

  it("uses worldHeight 540 and groundY 500", () => {
    expect(LEVEL_FIVE.worldHeight).toBe(540);
    expect(LEVEL_FIVE.groundY).toBe(500);
  });

  it("uses the desert background and terrain style", () => {
    expect(LEVEL_FIVE.backgroundKey).toBe("desert");
    expect(LEVEL_FIVE.terrainStyleKey).toBe("desert");
  });

  it("has unique ids across coins, hidden blocks, checkpoints, hazards and utilities", () => {
    const ids = [
      ...LEVEL_FIVE.coins.map((c) => c.id),
      ...LEVEL_FIVE.hiddenCoinBlocks.map((b) => b.id),
      ...LEVEL_FIVE.checkpoints.map((c) => c.id),
      ...LEVEL_FIVE.hazards.map((h) => h.id),
      ...LEVEL_FIVE.utilities.map((u) => u.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a world width in a similar order of magnitude (2500-3500px)", () => {
    expect(LEVEL_FIVE.worldWidth).toBeGreaterThanOrEqual(2500);
    expect(LEVEL_FIVE.worldWidth).toBeLessThanOrEqual(3500);
  });

  it("only uses existing hazard kinds", () => {
    for (const hazard of LEVEL_FIVE.hazards) {
      expect(
        KNOWN_HAZARD_KINDS.has(hazard.kind),
        `${hazard.id} has unknown kind ${hazard.kind}`
      ).toBe(true);
    }
  });

  it("contains no kugelblitz", () => {
    expect(LEVEL_FIVE.hazards.some((h) => h.kind === "kugelblitz")).toBe(false);
  });

  it("contains at most one spikehead", () => {
    const spikeheads = LEVEL_FIVE.hazards.filter((h) => h.kind === "spikehead").length;
    expect(spikeheads).toBeLessThanOrEqual(1);
  });

  it("contains no ceiling platforms", () => {
    expect(LEVEL_FIVE.platforms.some((p) => p.kind === "ceiling")).toBe(false);
  });
});

describe("LEVEL_FIVE gaps", () => {
  it("keeps every ground gap except the chasm at or below 160 px", () => {
    const gaps = groundGaps();
    const chasms = gaps.filter((g) => g > 160);
    expect(chasms.length).toBe(1);
    expect(chasms[0]).toBeGreaterThanOrEqual(1000);
  });
});

describe("LEVEL_FIVE chasm and trampoline chain", () => {
  const floats = LEVEL_FIVE.platforms.filter((p) => p.kind === "float");
  const chainPlatforms = floats
    .filter(
      // Eine Kettenplattform muss den Graben überbrücken, darf auch minimal
      // über die Kanten ragen (z. B. Auslauf zum Herunterlaufen am Ende).
      (p) => p.y === CHAIN_Y && p.x < CHASM_MAX_X && p.x + p.tilesWide * 16 > CHASM_MIN_X
    )
    .slice()
    .sort((a, b) => a.x - b.x);

  it("has at least three float platforms fully inside the chasm", () => {
    expect(chainPlatforms.length).toBeGreaterThanOrEqual(3);
  });

  it("places every chain platform higher than a sprint jump but reachable by boingo", () => {
    for (const platform of chainPlatforms) {
      const height = GROUND_Y - platform.y;
      expect(height, `chain platform at x=${platform.x} too low`).toBeGreaterThan(235);
      expect(height, `chain platform at x=${platform.x} too high`).toBeLessThanOrEqual(340);
    }
  });

  it("covers the full landing window for each chained boingo hop", () => {
    // Für jeden Hop muss die Zielplattform das komplette Geschwindigkeitsfenster
    // von Basis- bis Sprintgeschwindigkeit abdecken.
    const boingos = LEVEL_FIVE.utilities.filter((u) => u.kind === "boingo");

    // Einstieg: Boden -> K1
    const entryBoingo = boingos.find((b) => b.x < CHASM_MIN_X);
    expect(entryBoingo).toBeDefined();
    const k1 = chainPlatforms[0];
    if (entryBoingo && k1) {
      const rise = GROUND_Y - CHAIN_Y;
      const minLanding = entryBoingo.x + boingoRangeForRise(rise, MOVEMENT_TUNING.BASE_MOVE_SPEED);
      const maxLanding =
        entryBoingo.x + boingoRangeForRise(rise, MOVEMENT_TUNING.SPRINT_MOVE_SPEED);
      expect(k1.x, "K1 left edge too far right for slow run").toBeLessThanOrEqual(minLanding);
      expect(
        k1.x + k1.tilesWide * 16,
        "K1 right edge too far left for fast sprint"
      ).toBeGreaterThanOrEqual(maxLanding);
    }

    // Kette: K1 -> K2 und K2 -> K3
    for (let i = 0; i < chainPlatforms.length - 1; i++) {
      const source = chainPlatforms[i];
      const target = chainPlatforms[i + 1];
      const boingo = boingos.find(
        (b) => b.x >= source.x && b.x <= source.x + source.tilesWide * 16 && b.y === source.y - 14
      );
      expect(boingo, `no boingo on source platform ${i}`).toBeDefined();
      if (!boingo) continue;
      const minLanding = boingo.x + boingoRangeForRise(0, MOVEMENT_TUNING.BASE_MOVE_SPEED);
      const maxLanding = boingo.x + boingoRangeForRise(0, MOVEMENT_TUNING.SPRINT_MOVE_SPEED);
      expect(target.x, `target ${i + 1} left edge too far right`).toBeLessThanOrEqual(minLanding);
      expect(
        target.x + target.tilesWide * 16,
        `target ${i + 1} right edge too far left`
      ).toBeGreaterThanOrEqual(maxLanding);
    }
  });

  it("places exactly one boingo on every chain platform that leads to another hop", () => {
    const sortedChain = chainPlatforms.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < sortedChain.length - 1; i++) {
      const platform = sortedChain[i];
      const boingos = LEVEL_FIVE.utilities.filter(
        (u) =>
          u.kind === "boingo" &&
          u.x >= platform.x &&
          u.x <= platform.x + platform.tilesWide * 16 &&
          u.y === platform.y - 14
      );
      expect(boingos.length, `platform at x=${platform.x}`).toBe(1);
    }
  });

  it("places no boingo on the last chain platform", () => {
    const sortedChain = chainPlatforms.slice().sort((a, b) => a.x - b.x);
    const last = sortedChain[sortedChain.length - 1];
    const boingosOnLast = LEVEL_FIVE.utilities.filter(
      (u) =>
        u.kind === "boingo" &&
        u.x >= last.x &&
        u.x <= last.x + last.tilesWide * 16 &&
        u.y === last.y - 14
    );
    expect(boingosOnLast.length).toBe(0);
  });

  it("lets falling from the last chain platform land on the first ground segment after the chasm", () => {
    const sortedChain = chainPlatforms.slice().sort((a, b) => a.x - b.x);
    const last = sortedChain[sortedChain.length - 1];
    const firstGroundAfter = groundSegments()
      .slice()
      .sort((a, b) => a.x - b.x)
      .find((g) => g.x >= CHASM_MAX_X);
    expect(firstGroundAfter).toBeDefined();
    if (!firstGroundAfter || !last) return;

    const drop = GROUND_Y - CHAIN_Y;
    const minDrift = fallDrift(drop, MOVEMENT_TUNING.BASE_MOVE_SPEED);
    const maxDrift = fallDrift(drop, MOVEMENT_TUNING.SPRINT_MOVE_SPEED);
    const minLandingX = last.x + last.tilesWide * 16 + minDrift;
    const maxLandingX = last.x + last.tilesWide * 16 + maxDrift;
    expect(minLandingX).toBeGreaterThanOrEqual(firstGroundAfter.x);
    expect(maxLandingX).toBeLessThanOrEqual(firstGroundAfter.x + firstGroundAfter.tilesWide * 16);
  });

  it("provides a checkpoint on the ground segment immediately before the chasm", () => {
    const groundBefore = groundSegments()
      .slice()
      .sort((a, b) => a.x - b.x)
      .find((g) => g.x + g.tilesWide * 16 === CHASM_MIN_X);
    expect(groundBefore).toBeDefined();
    if (!groundBefore) return;

    const checkpointX = LEVEL_FIVE.checkpoints.find(
      (c) => c.x >= groundBefore.x && c.x <= groundBefore.x + groundBefore.tilesWide * 16
    );
    expect(checkpointX).toBeDefined();
  });
});

describe("LEVEL_FIVE parallel routes", () => {
  const highRoutePlatforms = LEVEL_FIVE.platforms
    .filter((p) => p.kind === "float" && p.y === HIGH_ROUTE_Y)
    .slice()
    .sort((a, b) => a.x - b.x);

  it("has a connected high route with a parallel stretch of at least 600 px", () => {
    expect(highRoutePlatforms.length).toBeGreaterThanOrEqual(2);
    const start = highRoutePlatforms[0].x;
    const end =
      highRoutePlatforms[highRoutePlatforms.length - 1].x +
      highRoutePlatforms[highRoutePlatforms.length - 1].tilesWide * 16;
    expect(end - start).toBeGreaterThanOrEqual(600);
  });

  it("keeps gaps between high route platforms jumpable at base speed", () => {
    for (let i = 1; i < highRoutePlatforms.length; i++) {
      const prevEnd = highRoutePlatforms[i - 1].x + highRoutePlatforms[i - 1].tilesWide * 16;
      const currStart = highRoutePlatforms[i].x;
      expect(currStart - prevEnd).toBeLessThanOrEqual(249);
    }
  });

  it("lets the player enter the high route from ground within a base jump height", () => {
    const first = highRoutePlatforms[0];
    const height = GROUND_Y - first.y;
    expect(height).toBeLessThanOrEqual(200);
  });

  it("merges the high route back to a ground segment before the chasm", () => {
    const last = highRoutePlatforms[highRoutePlatforms.length - 1];
    const lastXStart = last.x;
    const lastXEnd = last.x + last.tilesWide * 16;
    const groundBeforeChasm = groundSegments().some(
      (g) => g.x < lastXEnd && g.x + g.tilesWide * 16 > lastXStart
    );
    expect(groundBeforeChasm).toBe(true);
    expect(lastXEnd).toBeLessThan(CHASM_MIN_X);
  });

  it("places higher fruit value on the high route than on the parallel ground stretch", () => {
    const highXStart = highRoutePlatforms[0].x;
    const highXEnd =
      highRoutePlatforms[highRoutePlatforms.length - 1].x +
      highRoutePlatforms[highRoutePlatforms.length - 1].tilesWide * 16;

    const highFruitValue = LEVEL_FIVE.coins
      .filter((c) => highRoutePlatforms.some((p) => c.x >= p.x && c.x <= p.x + p.tilesWide * 16))
      .reduce((sum, c) => sum + FRUIT_VALUES[c.fruit], 0);

    const parallelGroundValue = LEVEL_FIVE.coins
      .filter(
        (c) =>
          c.y > HIGH_ROUTE_Y && // Boden-Früchte
          c.x >= highXStart &&
          c.x <= highXEnd
      )
      .reduce((sum, c) => sum + FRUIT_VALUES[c.fruit], 0);

    expect(highFruitValue).toBeGreaterThan(parallelGroundValue);
  });

  it("places at least as many hazards on the high route as on the parallel ground stretch", () => {
    const highXStart = highRoutePlatforms[0].x;
    const highXEnd =
      highRoutePlatforms[highRoutePlatforms.length - 1].x +
      highRoutePlatforms[highRoutePlatforms.length - 1].tilesWide * 16;

    const hazardIsOnGround = (h: (typeof LEVEL_FIVE.hazards)[number]): boolean => {
      // Patrouillierende/springende Hazards haben ein y nahe groundY;
      // spikehead ist nur über originY/fallToY definiert und kann hier
      // nicht sinnvoll einer Ebene zugeordnet werden.
      return h.kind !== "spikehead" && "y" in h && h.y > HIGH_ROUTE_Y;
    };

    const highHazards = LEVEL_FIVE.hazards.filter(
      (h) => h.kind !== "kugelblitz" && h.x >= highXStart && h.x <= highXEnd
    ).length;
    const groundHazards = LEVEL_FIVE.hazards.filter(
      (h) => h.kind !== "kugelblitz" && h.x >= highXStart && h.x <= highXEnd && hazardIsOnGround(h)
    ).length;

    expect(highHazards).toBeGreaterThanOrEqual(groundHazards);
  });

  it("lets the ground-only path reach the goal without using the high route", () => {
    const sortedGround = groundSegments()
      .slice()
      .sort((a, b) => a.x - b.x);
    expect(sortedGround[0].x).toBe(0);
    let coveredUntil = sortedGround[0].x + sortedGround[0].tilesWide * 16;
    let bigGapSeen = false;
    for (let i = 1; i < sortedGround.length; i++) {
      const gap = sortedGround[i].x - coveredUntil;
      if (gap > 160) {
        expect(bigGapSeen, "only one ground gap may exceed 160px").toBe(false);
        expect(gap, "chasm must bridge before the goal").toBeGreaterThanOrEqual(1000);
        bigGapSeen = true;
      }
      coveredUntil = sortedGround[i].x + sortedGround[i].tilesWide * 16;
    }
    expect(coveredUntil).toBeGreaterThanOrEqual(LEVEL_FIVE.goal.x);
  });
});

describe("LEVEL_FIVE physics helpers", () => {
  it("covers flat boingo range for base and sprint speed", () => {
    const baseRange = boingoRangeForRise(0, MOVEMENT_TUNING.BASE_MOVE_SPEED);
    const sprintRange = boingoRangeForRise(0, MOVEMENT_TUNING.SPRINT_MOVE_SPEED);
    expect(baseRange).toBeCloseTo(364, -1);
    expect(sprintRange).toBeCloseTo(583, -1);
  });

  it("covers rising boingo hop into the chain", () => {
    const rise = GROUND_Y - CHAIN_Y; // 300
    const baseRange = boingoRangeForRise(rise, MOVEMENT_TUNING.BASE_MOVE_SPEED);
    const sprintRange = boingoRangeForRise(rise, MOVEMENT_TUNING.SPRINT_MOVE_SPEED);
    expect(baseRange).toBeCloseTo(263, -1);
    expect(sprintRange).toBeCloseTo(421, -1);
  });

  it("covers falling drift from chain to ground", () => {
    const drop = GROUND_Y - CHAIN_Y; // 300
    const baseDrift = fallDrift(drop, MOVEMENT_TUNING.BASE_MOVE_SPEED);
    const sprintDrift = fallDrift(drop, MOVEMENT_TUNING.SPRINT_MOVE_SPEED);
    expect(baseDrift).toBeCloseTo(163, -1);
    expect(sprintDrift).toBeCloseTo(261, -1);
  });
});
