import { describe, expect, it } from "vitest";
import { CLEARANCE_HIGH, CLEARANCE_LOW, CLEARANCE_NORMAL, GROUND_Y, LEVEL_FOUR } from "./levelFour";
import { LEVEL_THREE } from "./levelThree";
import { LEVEL_TWO } from "./levelTwo";

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

describe("LEVEL_FOUR - ceiling as gameplay element", () => {
  function ceilingSegments() {
    return LEVEL_FOUR.platforms.filter((p) => p.kind === "ceiling");
  }

  it("covers the full world width with ceiling segments without gaps or overlaps", () => {
    const segments = ceilingSegments()
      .slice()
      .sort((a, b) => a.x - b.x);
    expect(segments[0].x).toBe(0);

    let coveredUntil = 0;
    for (const segment of segments) {
      expect(segment.x, `ceiling gap before x=${segment.x}`).toBe(coveredUntil);
      coveredUntil = segment.x + segment.tilesWide * 16;
    }
    expect(coveredUntil).toBe(LEVEL_FOUR.worldWidth);
  });

  it("uses only the three defined ceiling clearances and uses each at least once", () => {
    const allowedYs = new Set([
      GROUND_Y - CLEARANCE_LOW,
      GROUND_Y - CLEARANCE_NORMAL,
      GROUND_Y - CLEARANCE_HIGH,
    ]);
    const foundYs = new Set<number>();
    for (const ceiling of ceilingSegments()) {
      expect(allowedYs.has(ceiling.y), `unexpected ceiling y=${ceiling.y}`).toBe(true);
      foundYs.add(ceiling.y);
    }
    expect(foundYs.size).toBe(3);
  });

  it("lets a sprint jump fit under normal clearance (235px jump + 32px hitbox)", () => {
    expect(CLEARANCE_NORMAL).toBeGreaterThanOrEqual(235 + 32);
  });

  it("makes jumping useless in low-clearance zones (< 174px jump + 32px hitbox)", () => {
    expect(CLEARANCE_LOW).toBeLessThan(174 + 32);
  });

  it("keeps low-clearance zones solvable without jumping", () => {
    const lowZones = ceilingSegments().filter((c) => c.y === GROUND_Y - CLEARANCE_LOW);
    const grounds = groundSegments();
    const floats = LEVEL_FOUR.platforms.filter((p) => p.kind === "float");

    function rangeOverlaps(
      a: { x: number; tilesWide: number },
      b: { x: number; tilesWide: number }
    ) {
      const aEnd = a.x + a.tilesWide * 16;
      const bEnd = b.x + b.tilesWide * 16;
      return a.x < bEnd && aEnd > b.x;
    }

    for (const zone of lowZones) {
      // (a) keine Boden-Lücke in der Zone
      const groundOverZone = grounds.some((g) => rangeOverlaps(zone, g));
      expect(groundOverZone, `low zone at x=${zone.x} has a ground gap`).toBe(true);

      // (b) keine Float-Plattform in der Zone
      const floatInZone = floats.some((f) => rangeOverlaps(zone, f));
      expect(floatInZone, `low zone at x=${zone.x} contains a float platform`).toBe(false);

      // (c) nur zeitgesteuerte loderix-Hazards in der Zone
      for (const hazard of LEVEL_FOUR.hazards) {
        if (hazard.kind === "kugelblitz") continue;
        const hazardZone = { x: hazard.x - 8, tilesWide: 1 };
        if (!rangeOverlaps(zone, hazardZone)) continue;
        expect(
          hazard.kind,
          `low zone at x=${zone.x} contains non-loderix hazard ${hazard.id}`
        ).toBe("loderix");
      }
    }
  });
});

function groundSegments() {
  return LEVEL_FOUR.platforms.filter((p) => (p.kind ?? "ground") === "ground");
}

function groundGaps(): number[] {
  const groundPlatforms = groundSegments()
    .slice()
    .sort((a, b) => a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < groundPlatforms.length; i++) {
    const prev = groundPlatforms[i - 1];
    const curr = groundPlatforms[i];
    gaps.push(curr.x - (prev.x + prev.tilesWide * 16));
  }
  return gaps;
}

describe("LEVEL_FOUR - comfortable gaps (thematic, not a difficulty spike)", () => {
  it("keeps every ground gap at or below LEVEL_TWO's easiest gap (170px)", () => {
    for (const gap of groundGaps()) {
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(170);
    }
  });

  it("uses at least three distinct gap widths", () => {
    const distinctWidths = new Set(groundGaps());
    expect(distinctWidths.size).toBeGreaterThanOrEqual(3);
  });

  it("has more hazards than LEVEL_THREE but at most as many as LEVEL_TWO", () => {
    expect(LEVEL_THREE.hazards.length).toBeLessThan(LEVEL_FOUR.hazards.length);
    expect(LEVEL_FOUR.hazards.length).toBeLessThanOrEqual(LEVEL_TWO.hazards.length);
  });
});

describe("LEVEL_FOUR - hazards", () => {
  it("contains only existing hazard kinds", () => {
    const allowed = new Set([
      "schnetzler",
      "ninjafrog",
      "loderix",
      "spikehead",
      "kugelblitz",
    ]);
    for (const hazard of LEVEL_FOUR.hazards) {
      expect(allowed.has(hazard.kind), `${hazard.id} has unknown kind ${hazard.kind}`).toBe(true);
    }
  });

  it("contains at least one ninjafrog", () => {
    expect(LEVEL_FOUR.hazards.some((h) => h.kind === "ninjafrog")).toBe(true);
  });

  it("contains no kugelblitz", () => {
    expect(LEVEL_FOUR.hazards.some((h) => h.kind === "kugelblitz")).toBe(false);
  });

  it("anchors every spikehead to a ceiling and lets it fall to ground", () => {
    const spikeheads = LEVEL_FOUR.hazards.filter(
      (h): h is typeof h & { kind: "spikehead" } => h.kind === "spikehead"
    );
    expect(spikeheads.length).toBeGreaterThanOrEqual(1);

    for (const spike of spikeheads) {
      const section = LEVEL_FOUR.platforms
        .filter((p) => p.kind === "ceiling")
        .find((c) => c.x <= spike.x && spike.x < c.x + c.tilesWide * 16);
      expect(section, `spikehead ${spike.id} is not under any ceiling section`).toBeDefined();
      if (!section) continue;
      const ceilingBottom = section.y;
      expect(spike.originY, `spikehead ${spike.id} originY above ceiling`).toBeGreaterThanOrEqual(
        ceilingBottom
      );
      expect(
        spike.originY - ceilingBottom,
        `spikehead ${spike.id} hangs more than 32px below ceiling`
      ).toBeLessThanOrEqual(32);
      expect(spike.fallToY).toBe(GROUND_Y - 16);

      const groundUnderTrigger = groundSegments().some(
        (g) => g.x <= spike.triggerMinX && spike.triggerMaxX <= g.x + g.tilesWide * 16
      );
      expect(groundUnderTrigger, `spikehead ${spike.id} trigger zone is not over ground`).toBe(
        true
      );
    }
  });

  it("does not reuse LEVEL_THREE ground segmentation or hazard x-positions", () => {
    const fourGroundSignature = groundSegments()
      .map((p) => [p.x, p.tilesWide] as const)
      .sort((a, b) => a[0] - b[0]);
    const threeGroundSignature = LEVEL_THREE.platforms
      .filter((p) => (p.kind ?? "ground") === "ground")
      .map((p) => [p.x, p.tilesWide] as const)
      .sort((a, b) => a[0] - b[0]);
    expect(fourGroundSignature).not.toEqual(threeGroundSignature);

    const fourHazardXs = new Set(
      LEVEL_FOUR.hazards.map((h) => (h.kind === "kugelblitz" ? h.pivotX : h.x))
    );
    const threeHazardXs = new Set(
      LEVEL_THREE.hazards.map((h) => (h.kind === "kugelblitz" ? h.pivotX : h.x))
    );
    for (const x of fourHazardXs) {
      expect(threeHazardXs.has(x), `hazard x=${x} is also used in LEVEL_THREE`).toBe(false);
    }
  });
});

describe("LEVEL_FOUR - items and utilities", () => {
  function platformContains(platform: { x: number; tilesWide: number }, px: number): boolean {
    return px >= platform.x && px <= platform.x + platform.tilesWide * 16;
  }
  function isOverAnyGroundOrFloat(x: number): boolean {
    return LEVEL_FOUR.platforms
      .filter((p) => (p.kind ?? "ground") === "ground" || p.kind === "float")
      .some((p) => platformContains(p, x));
  }

  it("places every coin, hidden block, checkpoint and utility over ground or a float platform", () => {
    for (const coin of LEVEL_FOUR.coins) {
      expect(isOverAnyGroundOrFloat(coin.x), `${coin.id} has no carrier beneath it`).toBe(true);
    }
    for (const block of LEVEL_FOUR.hiddenCoinBlocks) {
      expect(isOverAnyGroundOrFloat(block.x), `${block.id} has no carrier beneath it`).toBe(true);
    }
    for (const checkpoint of LEVEL_FOUR.checkpoints) {
      expect(
        isOverAnyGroundOrFloat(checkpoint.x),
        `${checkpoint.id} has no carrier beneath it`
      ).toBe(true);
    }
    for (const utility of LEVEL_FOUR.utilities) {
      expect(isOverAnyGroundOrFloat(utility.x), `${utility.id} has no carrier beneath it`).toBe(
        true
      );
    }
  });
});
