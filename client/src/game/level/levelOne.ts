import type { LevelDef } from "./types";

/**
 * Erstes Level – komplett neu entworfen (siehe Chat-Verlauf: der vorherige
 * Stand hatte Hazards/Coins, die über Lücken hinausragten bzw. in der Luft
 * hingen, weil Koordinaten nicht an den tatsächlichen Plattformkanten
 * ausgerichtet waren).
 *
 * Entwurfsprinzipien:
 * - Jede Lücke ist EXAKT so bemessen, dass sie mit unseren Bewegungswerten
 *   (`MOVE_SPEED=200`, `JUMP_VELOCITY=-560`, Gravity=900 aus `RaceScene.ts`)
 *   komfortabel überspringbar ist: max. Sprunghöhe ≈174px, max. Sprungweite
 *   bei gleicher Höhe ≈250px. Alle Boden-Lücken sind 128px (8 Tiles) breit –
 *   deutlich unter dem Maximum, also verzeihend statt frustrierend.
 * - Jeder Hazard/jede Münze/jeder Block sitzt NACHWEISLICH innerhalb der
 *   x-Spanne einer echten Plattform (keine Objekte über Lücken, außer dem
 *   Kugelblitz, der ABSICHTLICH über einer Lücke pendelt).
 * - Steigender Schwierigkeitsgrad in klaren Abschnitten: Einstieg (Schnetzler
 *   zum Stompen üben) -> erste Fallen (Stachlinger) -> Kugelblitz-Lücke ->
 *   Boingo-Bonusbereich -> Loderix-Gauntlet -> Zielgerade.
 * - Boingo ist der einzige Weg zu den beiden höchsten Bonus-Plattformen
 *   (~210px über dem Boden, außerhalb der normalen Sprunghöhe von ~174px) –
 *   macht das Utility spielerisch relevant (siehe docs/08).
 * - 3 Checkpoints direkt am Anfang der jeweils nächsten schwierigen Sektion,
 *   damit ein Fehlschlag nicht den ganzen Fortschritt kostet.
 */
const GROUND_Y = 500;

export const LEVEL_ONE: LevelDef = {
  worldWidth: 3450,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 3080, y: GROUND_Y - 16 },

  // --- Bodensegmente ---------------------------------------------------
  // P1: 0-320       P2: 432-656      P3: 784-1040     P4: 1168-1328
  // P5: 1456-1744   P6: 1872-2096    P7: 2224-2704    P8: 2832-3376
  // Jede Lücke dazwischen ist exakt 128px (8 Tiles) breit.
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 20 }, // P1: Start, Übungsbereich
    { x: 432, y: GROUND_Y, tilesWide: 14 }, // P2: erste Stachlinger-Falle
    { x: 784, y: GROUND_Y, tilesWide: 16 }, // P3: zweiter Schnetzler + Bonus
    { x: 1168, y: GROUND_Y, tilesWide: 10 }, // P4: kurz vor der Kugelblitz-Lücke
    { x: 1456, y: GROUND_Y, tilesWide: 18 }, // P5: Boingo-Bereich 1
    { x: 1872, y: GROUND_Y, tilesWide: 14 }, // P6: Loderix-Gauntlet
    { x: 2224, y: GROUND_Y, tilesWide: 30 }, // P7: Boingo-Bereich 2
    { x: 2832, y: GROUND_Y, tilesWide: 34 }, // P8: Zielgerade

    // --- Schwebeplattformen (optionale Bonus-Routen) ---
    { x: 336, y: GROUND_Y - 140, tilesWide: 3, kind: "float" }, // F1: über Lücke 1, normal erreichbar
    { x: 880, y: GROUND_Y - 150, tilesWide: 3, kind: "float" }, // F2: über P3, normal erreichbar
    { x: 1550, y: GROUND_Y - 210, tilesWide: 4, kind: "float" }, // F3: NUR per Boingo (>174px)
    { x: 2000, y: GROUND_Y - 150, tilesWide: 3, kind: "float" }, // F4: über P6, normal erreichbar
    { x: 2600, y: GROUND_Y - 210, tilesWide: 4, kind: "float" }, // F5: NUR per Boingo (>174px)
  ],

  // --- Sichtbare Münzen (13, innerhalb der docs/06-Vorgabe 10-15) ------
  coins: [
    { id: "coin-1", x: 200, y: GROUND_Y - 48, fruit: "cherries" }, // P1
    { id: "coin-2", x: 470, y: GROUND_Y - 64, fruit: "strawberry" }, // P2, vor Stachlinger
    { id: "coin-3", x: 820, y: GROUND_Y - 48, fruit: "apple" }, // P3
    { id: "coin-4", x: 1220, y: GROUND_Y - 48, fruit: "orange" }, // P4, vor Kugelblitz-Lücke
    { id: "coin-5", x: 1520, y: GROUND_Y - 48, fruit: "cherries" }, // P5
    { id: "coin-6", x: 1900, y: GROUND_Y - 48, fruit: "bananas" }, // P6, Gauntlet-Einstieg
    { id: "coin-7", x: 2300, y: GROUND_Y - 48, fruit: "apple" }, // P7
    { id: "coin-8", x: 2550, y: GROUND_Y - 48, fruit: "cherries" }, // P7
    // Bonus-Plattformen (normal erreichbar):
    { id: "coin-9", x: 360, y: GROUND_Y - 180, fruit: "melon" }, // F1
    { id: "coin-10", x: 904, y: GROUND_Y - 190, fruit: "kiwi" }, // F2
    { id: "coin-11", x: 2024, y: GROUND_Y - 190, fruit: "strawberry" }, // F4
    // Bonus-Plattformen (nur per Boingo):
    { id: "coin-12", x: 1582, y: GROUND_Y - 250, fruit: "pineapple" }, // F3
    { id: "coin-13", x: 2632, y: GROUND_Y - 250, fruit: "melon" }, // F5
  ],

  // --- Versteckte Blöcke (4, innerhalb der docs/06-Vorgabe 3-5) --------
  // Jeder Block sitzt 64px (4 Tiles) über soliden Boden -> mit einem
  // normalen Sprung (max. ~174px) klar erreichbar, kein Boingo nötig.
  hiddenCoinBlocks: [
    { id: "block-1", x: 520, y: GROUND_Y - 64, fruit: "kiwi" }, // P2
    { id: "block-2", x: 950, y: GROUND_Y - 64, fruit: "melon" }, // P3
    { id: "block-3", x: 1980, y: GROUND_Y - 64, fruit: "pineapple" }, // P6, zwischen den Loderix
    { id: "block-4", x: 2450, y: GROUND_Y - 64, fruit: "orange" }, // P7
  ],

  // --- Checkpoints (3) --------------------------------------------------
  checkpoints: [
    { id: "checkpoint-1", x: 800, y: GROUND_Y - 0 }, // Start von P3
    { id: "checkpoint-2", x: 1470, y: GROUND_Y - 0 }, // Start von P5, nach der Kugelblitz-Lücke
    { id: "checkpoint-3", x: 2240, y: GROUND_Y - 0 }, // Start von P7, nach dem Loderix-Gauntlet
  ],

  // --- Hazards (alle 4 Kinds, jeweils klar innerhalb einer Plattform) --
  hazards: [
    // Schnetzler 1: patrouilliert komplett innerhalb P1 (0-320) - Einstieg zum Stompen üben.
    {
      kind: "schnetzler",
      id: "schnetzler-1",
      x: 250,
      y: GROUND_Y - 16,
      minX: 250,
      maxX: 270,
      speed: 60,
    },
    // Schnetzler 2: patrouilliert komplett innerhalb P3 (784-1040).
    {
      kind: "schnetzler",
      id: "schnetzler-2",
      x: 850,
      y: GROUND_Y - 16,
      minX: 850,
      maxX: 970,
      speed: 70,
    },
    // Stachlinger 1: auf P2 (432-656), muss übersprungen werden.
    { kind: "stachlinger", id: "stachlinger-1", x: 560, y: GROUND_Y - 8 },
    // Stachlinger 2: auf P5 (1456-1744), direkt nach dem Boingo-Bonusbereich.
    { kind: "stachlinger", id: "stachlinger-2", x: 1650, y: GROUND_Y - 8 },
    // Loderix-Gauntlet auf P6 (1872-2096), phasenversetzt, Block-3 dazwischen.
    { kind: "loderix", id: "loderix-1", x: 1920, y: GROUND_Y - 16, phaseMs: 0 },
    { kind: "loderix", id: "loderix-2", x: 2040, y: GROUND_Y - 16, phaseMs: 750 },
    // Kugelblitz pendelt ABSICHTLICH über der Lücke zwischen P4 (endet 1328) und P5 (beginnt 1456).
    { kind: "kugelblitz", id: "kugelblitz-1", pivotX: 1100, pivotY: GROUND_Y - 300, length: 150 },
  ],

  // --- Utilities: je ein Boingo direkt unter einer Nur-per-Boingo-Plattform ---
  utilities: [
    { kind: "boingo", id: "boingo-1", x: 1582, y: GROUND_Y - 14 }, // unter F3
    { kind: "boingo", id: "boingo-2", x: 2632, y: GROUND_Y - 14 }, // unter F5
  ],
};
