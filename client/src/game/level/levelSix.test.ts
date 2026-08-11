import { describe, expect, it } from "vitest";
import { isTimedActive } from "../hazards/behaviors";
import { MOVEMENT_TUNING } from "../movement/movement";
import { GAUNTLET_ZONE_MAX_X, GAUNTLET_ZONE_MIN_X, GROUND_Y, LEVEL_SIX } from "./levelSix";
import type { HazardInstanceDef } from "./types";

function requireHazard<K extends HazardInstanceDef["kind"]>(
  id: string,
  kind: K
): Extract<HazardInstanceDef, { kind: K }> {
  const hazard = LEVEL_SIX.hazards.find((h) => h.id === id);
  if (!hazard || hazard.kind !== kind) {
    throw new Error(`hazard ${id} not found or has unexpected kind`);
  }
  return hazard as Extract<HazardInstanceDef, { kind: K }>;
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
  return LEVEL_SIX.platforms.filter((p) => (p.kind ?? "ground") === "ground");
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

describe("LEVEL_SIX structure", () => {
  it("has 10-15 visible coins", () => {
    expect(LEVEL_SIX.coins.length).toBeGreaterThanOrEqual(10);
    expect(LEVEL_SIX.coins.length).toBeLessThanOrEqual(15);
  });

  it("has 3-5 hidden coin blocks", () => {
    expect(LEVEL_SIX.hiddenCoinBlocks.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_SIX.hiddenCoinBlocks.length).toBeLessThanOrEqual(5);
  });

  it("has at least 3 checkpoints, exactly one spawn and exactly one goal", () => {
    expect(LEVEL_SIX.checkpoints.length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_SIX.spawn).toBeDefined();
    expect(LEVEL_SIX.goal).toBeDefined();
  });

  it("uses worldHeight 540 and groundY 500", () => {
    expect(LEVEL_SIX.worldHeight).toBe(540);
    expect(LEVEL_SIX.groundY).toBe(500);
    expect(GROUND_Y).toBe(500);
  });

  it("uses the ice background and terrain style", () => {
    expect(LEVEL_SIX.backgroundKey).toBe("ice");
    expect(LEVEL_SIX.terrainStyleKey).toBe("ice");
  });

  it("has unique ids across coins, hidden blocks, checkpoints, hazards and utilities", () => {
    const ids = [
      ...LEVEL_SIX.coins.map((c) => c.id),
      ...LEVEL_SIX.hiddenCoinBlocks.map((b) => b.id),
      ...LEVEL_SIX.checkpoints.map((c) => c.id),
      ...LEVEL_SIX.hazards.map((h) => h.id),
      ...LEVEL_SIX.utilities.map((u) => u.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses existing hazard kinds", () => {
    for (const hazard of LEVEL_SIX.hazards) {
      expect(
        KNOWN_HAZARD_KINDS.has(hazard.kind),
        `${hazard.id} has unknown kind ${hazard.kind}`
      ).toBe(true);
    }
  });

  it("contains ninjafrog, stachlinger and kugelblitz at least once each", () => {
    for (const kind of ["ninjafrog", "stachlinger", "kugelblitz"] as const) {
      expect(
        LEVEL_SIX.hazards.some((h) => h.kind === kind),
        `missing ${kind}`
      ).toBe(true);
    }
  });

  it("contains exactly two loderix and exactly one spikehead", () => {
    expect(LEVEL_SIX.hazards.filter((h) => h.kind === "loderix").length).toBe(2);
    expect(LEVEL_SIX.hazards.filter((h) => h.kind === "spikehead").length).toBe(1);
  });

  it("contains no ceiling platforms", () => {
    expect(LEVEL_SIX.platforms.some((p) => p.kind === "ceiling")).toBe(false);
  });
});

describe("LEVEL_SIX gaps", () => {
  it("keeps every ground gap at or below 190 px (no mandatory chasm in Level 6)", () => {
    for (const gap of groundGaps()) {
      expect(gap).toBeLessThanOrEqual(190);
    }
  });
});

describe("LEVEL_SIX gauntlet zone bounds", () => {
  it("exports a gauntlet zone that lies within the world", () => {
    expect(GAUNTLET_ZONE_MIN_X).toBeLessThan(GAUNTLET_ZONE_MAX_X);
    expect(GAUNTLET_ZONE_MIN_X).toBeGreaterThan(0);
    expect(GAUNTLET_ZONE_MAX_X).toBeLessThan(LEVEL_SIX.worldWidth);
  });
});

describe("LEVEL_SIX frost gauntlet timing invariant", () => {
  const loderix1 = requireHazard("loderix-1", "loderix");
  const loderix2 = requireHazard("loderix-2", "loderix");
  const spikehead = requireHazard("spikehead-1", "spikehead");

  it("gives both loderix instances an equal on/off duration", () => {
    expect(loderix1.onMs).toBe(loderix1.offMs);
    expect(loderix2.onMs).toBe(loderix2.offMs);
    expect(loderix1.onMs).toBe(loderix2.onMs);
  });

  it("offsets loderix-2 by exactly half a cycle from loderix-1", () => {
    const cycleMs = (loderix1.onMs ?? 0) + (loderix1.offMs ?? 0);
    const expectedPhase = ((loderix1.phaseMs ?? 0) + cycleMs / 2) % cycleMs;
    expect((loderix2.phaseMs ?? 0) % cycleMs).toBe(expectedPhase);
  });

  it("has exactly one of the two loderix instances active at any sampled moment", () => {
    const cycleMs = (loderix1.onMs ?? 0) + (loderix1.offMs ?? 0);
    const sampleCount = 200;
    for (let i = 0; i < sampleCount; i++) {
      const t = (i / sampleCount) * cycleMs * 2;
      const active1 = isTimedActive(loderix1, t);
      const active2 = isTimedActive(loderix2, t);
      expect(active1, `t=${t}`).not.toBe(active2);
    }
  });

  it("spaces the two loderix instances so a well-timed sprint run reaches the safe window", () => {
    const cycleMs = (loderix1.onMs ?? 0) + (loderix1.offMs ?? 0); // 1800
    const distance = loderix2.x - loderix1.x;
    const travelMs = (distance / MOVEMENT_TUNING.SPRINT_MOVE_SPEED) * 1000;
    // Bot passiert loderix-1 exakt beim Wechsel aktiv->sicher (t0 = halbe
    // Zykluslänge). Sicheres Fenster bei loderix-2 verlangt travelMs in
    // [halbe Zykluslänge, ganze Zykluslänge) – siehe design.md Herleitung.
    expect(travelMs).toBeGreaterThanOrEqual(cycleMs / 2);
    expect(travelMs).toBeLessThan(cycleMs);
  });

  it("starts the spikehead trigger zone within 40px after loderix-2", () => {
    expect(spikehead.triggerMinX - loderix2.x).toBeGreaterThan(0);
    expect(spikehead.triggerMinX - loderix2.x).toBeLessThanOrEqual(40);
  });

  it("makes the spikehead fall to the gauntlet's ground level", () => {
    expect(spikehead.fallToY).toBe(GROUND_Y - 16);
  });

  it("provides a checkpoint immediately before loderix-1 and immediately after the spikehead trigger", () => {
    const checkpointBefore = LEVEL_SIX.checkpoints.find((c) => c.x === GAUNTLET_ZONE_MIN_X);
    const checkpointAfter = LEVEL_SIX.checkpoints.find((c) => c.x === GAUNTLET_ZONE_MAX_X);
    expect(checkpointBefore).toBeDefined();
    expect(checkpointAfter).toBeDefined();
    expect(loderix1.x - GAUNTLET_ZONE_MIN_X).toBeGreaterThan(0);
    expect(loderix1.x - GAUNTLET_ZONE_MIN_X).toBeLessThanOrEqual(20);
    expect(GAUNTLET_ZONE_MAX_X - spikehead.triggerMaxX).toBeGreaterThan(0);
    expect(GAUNTLET_ZONE_MAX_X - spikehead.triggerMaxX).toBeLessThanOrEqual(100);
  });

  it("covers the gauntlet zone with a single continuous ground platform (no gap, no platform change)", () => {
    const covering = LEVEL_SIX.platforms.filter(
      (p) =>
        (p.kind ?? "ground") === "ground" &&
        p.x <= GAUNTLET_ZONE_MIN_X &&
        p.x + p.tilesWide * 16 >= GAUNTLET_ZONE_MAX_X
    );
    expect(covering.length).toBe(1);
  });
});
