import type { LevelDef } from "./types";

/**
 * Zweites Level – "Kaizo Light" (siehe `.features/level-two-kaizo/`).
 *
 * Baut auf denselben Bewegungswerten wie `LEVEL_ONE` auf (`MOVE_SPEED=200`,
 * `JUMP_VELOCITY=-560`, Gravity=900 aus `RaceScene.ts`: max. Sprunghöhe
 * ≈174px, max. Sprungweite bei gleicher Höhe ≈250px), setzt die
 * Schwierigkeit aber spürbar enger:
 * - Boden-Lücken sind 176-208px breit (statt 128px in `LEVEL_ONE`) - immer
 *   noch mit ausreichend Puffer zum physikalischen Limit (~250px), aber
 *   deutlich enger als Level 1.
 * - Ein Gegner-Gauntlet (P2) reiht 3 Schnetzler mit eng aneinander
 *   anschließenden Patrol-Bereichen auf einer einzigen, schmalen Plattform
 *   auf - präzises Timen nötig, kein Durchlaufen ohne Reaktion.
 * - Neu: Spikehead (P3) - fällt nach kurzer Vorwarnzeit auf die Passage
 *   herab, sobald die Trigger-Zone betreten wird.
 * - 3 Checkpoints, jeweils direkt vor der nächsten schwierigen Sektion
 *   (ähnlich dicht wie in Level 1).
 */
const GROUND_Y = 500;

export const LEVEL_TWO: LevelDef = {
  worldWidth: 3150,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 2900, y: GROUND_Y - 16 },
  // Prozeduraler, an SMB1-1 angelehnter Hintergrund (siehe
  // `.features/level-two-background/`) statt des einfarbigen Standard-Hintergrunds.
  backgroundKey: "smb1-1",

  // --- Bodensegmente ------------------------------------------------
  // P1: 0-288        P2: 464-688       P3: 864-1088     P4: 1296-1456
  // P5: 1632-1920    P6: 2096-2320     P7: 2496-3008
  // Lücken: 176 / 176 / 208 (Kugelblitz-Gauntlet) / 176 / 176 / 176.
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 18 }, // P1: Start
    { x: 464, y: GROUND_Y, tilesWide: 14 }, // P2: Schnetzler-Gauntlet
    { x: 864, y: GROUND_Y, tilesWide: 14 }, // P3: Stachlinger + Spikehead
    { x: 1296, y: GROUND_Y, tilesWide: 10 }, // P4: vor der Kugelblitz-Lücke
    { x: 1632, y: GROUND_Y, tilesWide: 18 }, // P5: Boingo-Bereich + Loderix
    { x: 2096, y: GROUND_Y, tilesWide: 14 }, // P6: zweiter Schnetzler + Stachlinger
    { x: 2496, y: GROUND_Y, tilesWide: 32 }, // P7: Zielgerade

    // --- Schwebeplattformen (Bonus-Routen) ---
    { x: 300, y: GROUND_Y - 180, tilesWide: 3, kind: "float" }, // F1: über Lücke 1, normal erreichbar
    { x: 1750, y: GROUND_Y - 250, tilesWide: 4, kind: "float" }, // F2: NUR per Boingo (>174px)
  ],

  // --- Sichtbare Münzen (13) ------------------------------------------
  coins: [
    { id: "coin-1", x: 150, y: GROUND_Y - 48, fruit: "cherries" }, // P1
    { id: "coin-2", x: 500, y: GROUND_Y - 64, fruit: "strawberry" }, // P2, Gauntlet-Einstieg
    { id: "coin-3", x: 650, y: GROUND_Y - 48, fruit: "apple" }, // P2, Gauntlet-Ausgang
    { id: "coin-4", x: 1000, y: GROUND_Y - 48, fruit: "orange" }, // P3
    { id: "coin-5", x: 1350, y: GROUND_Y - 48, fruit: "cherries" }, // P4
    { id: "coin-6", x: 1680, y: GROUND_Y - 48, fruit: "bananas" }, // P5
    { id: "coin-7", x: 1850, y: GROUND_Y - 48, fruit: "kiwi" }, // P5
    { id: "coin-8", x: 2150, y: GROUND_Y - 48, fruit: "apple" }, // P6
    { id: "coin-9", x: 2280, y: GROUND_Y - 48, fruit: "cherries" }, // P6
    { id: "coin-10", x: 2600, y: GROUND_Y - 48, fruit: "orange" }, // P7
    { id: "coin-11", x: 2800, y: GROUND_Y - 48, fruit: "melon" }, // P7
    // Bonus-Plattformen:
    { id: "coin-12", x: 316, y: GROUND_Y - 210, fruit: "melon" }, // F1, normal erreichbar
    { id: "coin-13", x: 1774, y: GROUND_Y - 280, fruit: "pineapple" }, // F2, nur per Boingo
  ],

  // --- Versteckte Blöcke (4) --------------------------------------------
  hiddenCoinBlocks: [
    { id: "block-1", x: 950, y: GROUND_Y - 64, fruit: "kiwi" }, // P3, vor dem Spikehead
    { id: "block-2", x: 1380, y: GROUND_Y - 64, fruit: "melon" }, // P4
    { id: "block-3", x: 2200, y: GROUND_Y - 64, fruit: "pineapple" }, // P6
    { id: "block-4", x: 2650, y: GROUND_Y - 64, fruit: "orange" }, // P7
  ],

  // --- Checkpoints (3), jeweils vor der nächsten schweren Sektion -------
  checkpoints: [
    { id: "checkpoint-1", x: 864, y: GROUND_Y - 0 }, // Start von P3, nach dem Gauntlet
    { id: "checkpoint-2", x: 1632, y: GROUND_Y - 0 }, // Start von P5, nach der Kugelblitz-Lücke
    { id: "checkpoint-3", x: 2096, y: GROUND_Y - 0 }, // Start von P6
  ],

  // --- Hazards (alle 5 Kinds, inkl. neuem Spikehead) --------------------
  hazards: [
    // ninjafrog-Gauntlet: 3 Frogs mit eng aneinander anschließenden
    // Patrol-Bereichen, alle innerhalb P2 (464-688) - präzises Timen nötig,
    // kein Durchlaufen ohne Reaktion.
    {
      kind: "ninjafrog",
      id: "ninjafrog-1",
      x: 480,
      y: GROUND_Y - 16,
      minX: 480,
      maxX: 520,
      speed: 70,
    },
    {
      kind: "ninjafrog",
      id: "ninjafrog-2",
      x: 520,
      y: GROUND_Y - 16,
      minX: 520,
      maxX: 560,
      speed: 80,
    },
    {
      kind: "ninjafrog",
      id: "ninjafrog-3",
      x: 560,
      y: GROUND_Y - 16,
      minX: 560,
      maxX: 600,
      speed: 90,
    },
    // Zweiter, einzelner Schnetzler auf P6 (2096-2320).
    {
      kind: "schnetzler",
      id: "schnetzler-4",
      x: 2150,
      y: GROUND_Y - 16,
      minX: 2150,
      maxX: 2250,
      speed: 80,
    },
    // Stachlinger auf P3 (864-1088) und P6 (2096-2320).
    // { kind: "stachlinger", id: "stachlinger-1", x: 950, y: GROUND_Y - 8 },
    { kind: "stachlinger", id: "stachlinger-2", x: 2280, y: GROUND_Y - 8 },
    // Loderix-Gauntlet auf P5 (1632-1920), phasenversetzt.
    { kind: "loderix", id: "loderix-1", x: 1700, y: GROUND_Y - 16, phaseMs: 0 },
    { kind: "loderix", id: "loderix-2", x: 1820, y: GROUND_Y - 16, phaseMs: 750 },
    // Kugelblitz pendelt ABSICHTLICH über der Lücke zwischen P4 (endet 1456) und P5 (beginnt 1632).
    { kind: "kugelblitz", id: "kugelblitz-1", pivotX: 1544, pivotY: GROUND_Y - 300, length: 150 },
    // Spikehead auf P3 (864-1088): löst aus, sobald die enge Passage vor
    // ihm (ab x=950, wo auch der versteckte Block sitzt) betreten wird.
    {
      kind: "spikehead",
      id: "spikehead-1",
      x: 1030,
      originY: GROUND_Y - 200,
      fallToY: GROUND_Y - 16,
      triggerMinX: 950,
      triggerMaxX: 1030,
    },
  ],

  // --- Utilities: ein Boingo direkt unter der Nur-per-Boingo-Plattform ---
  utilities: [{ kind: "boingo", id: "boingo-1", x: 1750, y: GROUND_Y - 14 }], // unter F2
};
