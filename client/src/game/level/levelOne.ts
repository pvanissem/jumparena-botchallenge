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
 * - Steigender Schwierigkeitsgrad in klaren Abschnitten: Einstieg (Ninja-Frog
 *   zum Stompen üben) -> erste Fallen (Stachlinger) -> Kugelblitz-Lücke ->
 *   Boingo-Bonusbereich -> Loderix-Gauntlet -> Zielgerade.
 * - Boingo ist der einzige Weg zu den beiden höchsten Bonus-Plattformen
 *   (~210px über dem Boden, außerhalb der normalen Sprunghöhe von ~174px) –
 *   macht das Utility spielerisch relevant (siehe docs/08).
 * - 3 Checkpoints direkt am Anfang der jeweils nächsten schwierigen Sektion,
 *   damit ein Fehlschlag nicht den ganzen Fortschritt kostet.
 */
const GROUND_Y = 500;

/**
 * Deckenhöhen für den Kriechgang in Sektion D (Muster aus `levelFour.ts`
 * übernommen): LOW erzwingt reines Laufen (Springen bringt nichts), NORMAL
 * lässt jeden normalen Sprung ungehindert zu.
 */
const CLEARANCE_LOW = 64;
const CLEARANCE_NORMAL = 272;
const CEILING_Y_LOW = GROUND_Y - CLEARANCE_LOW;
const CEILING_Y_NORMAL = GROUND_Y - CLEARANCE_NORMAL;

/** Höhe der Trampolin-Kette in Sektion F (identischer Absolutwert wie in `levelFive.ts`, da gleiches GROUND_Y). */
const CHAIN_Y = 200;

export const LEVEL_ONE: LevelDef = {
  worldWidth: 7952,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 7792, y: GROUND_Y - 16 },

  // --- Bodensegmente ---------------------------------------------------
  // P1: 0-320       P2: 432-656      P3: 784-1040     P4: 1168-1328
  // P5: 1456-1744   P6: 1872-2096    P7: 2224-2704    P8: 2832-3376
  // Jede Lücke dazwischen ist exakt 128px (8 Tiles) breit.
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 20 }, // P1: Start, Übungsbereich
    { x: 432, y: GROUND_Y, tilesWide: 14 }, // P2: erste Stachlinger-Falle
    { x: 784, y: GROUND_Y, tilesWide: 16 }, // P3: zweiter Ninja-Frog + Bonus
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

    // --- Sektion A: Schnetzler-Einführung -------------------------------
    { x: 3504, y: GROUND_Y, tilesWide: 20 }, // P9: 3504-3824

    // --- Sektion B: enges 3er-Gauntlet ----------------------------------
    { x: 3952, y: GROUND_Y, tilesWide: 18 }, // P10: 3952-4240

    // --- Sektion C: Spikehead solo ---------------------------------------
    { x: 4368, y: GROUND_Y, tilesWide: 20 }, // P11: 4368-4688

    // --- Sektion D: Decken-Kriechgang -------------------------------------
    { x: 4816, y: GROUND_Y, tilesWide: 24 }, // P12: 4816-5200
    { x: 4816, y: CEILING_Y_NORMAL, tilesWide: 8, kind: "ceiling" }, // normaler Einstieg: 4816-4944
    { x: 4944, y: CEILING_Y_LOW, tilesWide: 8, kind: "ceiling" }, // Crawl-Kern: 4944-5072
    { x: 5072, y: CEILING_Y_NORMAL, tilesWide: 8, kind: "ceiling" }, // normaler Ausgang: 5072-5200

    // --- Sektion E: verkettetes Timing-Puzzle (Loderix-Gegenphase + Spikehead) ---
    { x: 5328, y: GROUND_Y, tilesWide: 44 }, // P13: 5328-6032

    // --- Sektion F: Pflicht-Boingo-Kette über Abgrund ---------------------
    // Abgrund direkt an P13's Kante (6032) bis zum Beginn von P14 (7232) -
    // 1200px, exakt wie der "Große Graben" in Level 5.
    { x: 6192, y: CHAIN_Y, tilesWide: 12, kind: "float" }, // K1: 6192-6384
    { x: 6592, y: CHAIN_Y, tilesWide: 17, kind: "float" }, // K2: 6592-6864
    { x: 6976, y: CHAIN_Y, tilesWide: 17, kind: "float" }, // K3: 6976-7248 (überragt die Kante leicht)
    { x: 7232, y: GROUND_Y, tilesWide: 40 }, // P14: 7232-7872, Landeplattform + Zielgerade
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

    // --- Sektion A ---
    { id: "coin-14", x: 3620, y: GROUND_Y - 48, fruit: "strawberry" }, // P9, zwischen Ninja-Frog und Schnetzler
    // --- Sektion B ---
    { id: "coin-15", x: 4200, y: GROUND_Y - 48, fruit: "apple" }, // P10, Gauntlet-Ausgang
    // --- Sektion C ---
    { id: "coin-16", x: 4420, y: GROUND_Y - 48, fruit: "orange" }, // P11, vor der Trigger-Zone
    // --- Sektion D ---
    { id: "coin-17", x: 4960, y: GROUND_Y - 30, fruit: "kiwi" }, // P12, im Crawl-Kern
    { id: "coin-18", x: 5024, y: GROUND_Y - 30, fruit: "melon" }, // P12, im Crawl-Kern
    // --- Sektion E ---
    { id: "coin-19", x: 5360, y: GROUND_Y - 48, fruit: "cherries" }, // P13, vor dem Puzzle
    { id: "coin-20", x: 5960, y: GROUND_Y - 48, fruit: "pineapple" }, // P13, nach dem Puzzle
    // --- Sektion F ---
    { id: "coin-21", x: 6288, y: CHAIN_Y - 48, fruit: "orange" }, // K1
    { id: "coin-22", x: 6728, y: CHAIN_Y - 48, fruit: "orange" }, // K2
    { id: "coin-23", x: 7112, y: CHAIN_Y - 48, fruit: "orange" }, // K3
    { id: "coin-24", x: 7500, y: GROUND_Y - 48, fruit: "bananas" }, // P14, Zielgerade
  ],

  // --- Versteckte Blöcke (4, innerhalb der docs/06-Vorgabe 3-5) --------
  // Jeder Block sitzt 64px (4 Tiles) über soliden Boden -> mit einem
  // normalen Sprung (max. ~174px) klar erreichbar, kein Boingo nötig.
  hiddenCoinBlocks: [
    { id: "block-1", x: 520, y: GROUND_Y - 64, fruit: "kiwi" }, // P2
    { id: "block-2", x: 950, y: GROUND_Y - 64, fruit: "melon" }, // P3
    { id: "block-3", x: 1980, y: GROUND_Y - 64, fruit: "pineapple" }, // P6, zwischen den Loderix
    { id: "block-4", x: 2450, y: GROUND_Y - 64, fruit: "orange" }, // P7
    { id: "block-5", x: 4210, y: GROUND_Y - 64, fruit: "kiwi" }, // P10, Gauntlet-Ausgang
    { id: "block-6", x: 4480, y: GROUND_Y - 64, fruit: "melon" }, // P11, markiert den Spikehead-Trigger-Beginn
    { id: "block-7", x: 6728, y: CHAIN_Y - 64, fruit: "pineapple" }, // K2, Bonus auf der Kette
  ],

  // --- Checkpoints (3) --------------------------------------------------
  // y-Position entspricht der sichtbaren Fahnen-Position auf Bodenhöhe. Der
  // Höhen-Offset beim Respawn (damit der Bot nicht im Terrain landet) wird
  // NICHT hier, sondern in `loseLifeAndRespawn` (raceRules.ts) angewendet,
  // damit die Fahnen visuell korrekt auf dem Boden stehen (siehe Chat-Verlauf).
  checkpoints: [
    { id: "checkpoint-2", x: 1470, y: GROUND_Y - 0 }, // Start von P5, nach der Kugelblitz-Lücke
    { id: "checkpoint-3", x: 2240, y: GROUND_Y - 0 }, // Start von P7, nach dem Loderix-Gauntlet
    { id: "checkpoint-4", x: 3504, y: GROUND_Y - 0 }, // Start von P9, Schnetzler-Einführung
    { id: "checkpoint-5", x: 3952, y: GROUND_Y - 0 }, // Start von P10, enges 3er-Gauntlet
    { id: "checkpoint-6", x: 4368, y: GROUND_Y - 0 }, // Start von P11, Spikehead solo
    { id: "checkpoint-7", x: 4816, y: GROUND_Y - 0 }, // Start von P12, vor dem Kriechgang
    { id: "checkpoint-8", x: 5450, y: GROUND_Y - 0 }, // P13, direkt vor dem Loderix/Spikehead-Puzzle
    { id: "checkpoint-11", x: 7232, y: GROUND_Y - 0 }, // Start von P14, direkt nach dem Abgrund
  ],

  // --- Hazards (alle 4 Kinds, jeweils klar innerhalb einer Plattform) --
  hazards: [
    // Ninja-Frog 1: patrouilliert komplett innerhalb P1 (0-320) - Einstieg zum Stompen üben.
    // (Vorher ein Schnetzler; der ist inzwischen NICHT mehr stompbar, siehe
    // hazards/registry.ts - der stompbare Gegner ist der Ninja-Frog.)
    {
      kind: "ninjafrog",
      id: "ninjafrog-1",
      x: 250,
      y: GROUND_Y - 16,
      minX: 250,
      maxX: 270,
      speed: 60,
    },
    // Ninja-Frog 2: patrouilliert komplett innerhalb P3 (784-1040).
    {
      kind: "ninjafrog",
      id: "ninjafrog-2",
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

    // --- Sektion A: Schnetzler-Einführung auf P9 (3504-3824) --------------
    // Ninja-Frog und Schnetzler räumlich klar getrennt, damit der Unterschied
    // stompbar/nicht-stompbar (siehe hazards/registry.ts) sauber erfahrbar ist.
    {
      kind: "ninjafrog",
      id: "ninjafrog-3",
      x: 3524,
      y: GROUND_Y - 16,
      minX: 3524,
      maxX: 3564,
      speed: 60,
    },
    {
      kind: "schnetzler",
      id: "schnetzler-1",
      x: 3700,
      y: GROUND_Y - 16,
      minX: 3700,
      maxX: 3740,
      speed: 60,
    },

    // --- Sektion B: enges 3er-Gauntlet auf P10 (3952-4240) -----------------
    // Knapp aneinandergrenzende Patrol-Zonen (10px Puffer) - präzises Timen
    // nötig, aber etwas großzügiger als Level 2's exakt anliegende Zonen.
    {
      kind: "ninjafrog",
      id: "ninjafrog-4",
      x: 3984,
      y: GROUND_Y - 16,
      minX: 3984,
      maxX: 4034,
      speed: 60,
    },
    {
      kind: "schnetzler",
      id: "schnetzler-2",
      x: 4044,
      y: GROUND_Y - 16,
      minX: 4044,
      maxX: 4094,
      speed: 65,
    },
    {
      kind: "ninjafrog",
      id: "ninjafrog-5",
      x: 4104,
      y: GROUND_Y - 16,
      minX: 4104,
      maxX: 4154,
      speed: 70,
    },

    // --- Sektion C: Spikehead solo auf P11 (4368-4688) ---------------------
    // Hidden Block markiert den Trigger-Beginn (siehe levelTwo.ts).
    {
      kind: "spikehead",
      id: "spikehead-1",
      x: 4560,
      originY: GROUND_Y - 200,
      fallToY: GROUND_Y - 16,
      triggerMinX: 4480,
      triggerMaxX: 4560,
    },

    // --- Sektion E: verkettetes Timing-Puzzle auf P13 (5328-6032) ----------
    // Gegenphasiges Loderix-Paar (wie Level 6's Frost-Gauntlet), aber auf
    // Basis-Tempo (200px/s) statt Sprint-Tempo entschärft: Abstand 300px, ein
    // Bot, der loderix-3 exakt beim Wechsel aktiv->sicher passiert und
    // durchgehend läuft, erreicht loderix-4 nach 1500ms - innerhalb von dessen
    // sicherem Fenster [1300ms, 2600ms).
    {
      kind: "loderix",
      id: "loderix-3",
      x: 5470,
      y: GROUND_Y - 16,
      onMs: 1300,
      offMs: 1300,
      phaseMs: 0,
    },
    {
      kind: "loderix",
      id: "loderix-4",
      x: 5770,
      y: GROUND_Y - 16,
      onMs: 1300,
      offMs: 1300,
      phaseMs: 1300,
    },
    // Spikehead direkt danach (Trigger-Zone beginnt 20px nach loderix-4, wie
    // in Level 6's Frost-Gauntlet).
    {
      kind: "spikehead",
      id: "spikehead-2",
      x: 5850,
      originY: GROUND_Y - 200,
      fallToY: GROUND_Y - 16,
      triggerMinX: 5790,
      triggerMaxX: 5850,
    },
  ],

  // --- Utilities: je ein Boingo direkt unter einer Nur-per-Boingo-Plattform,
  // plus die Pflicht-Kette über den Abgrund in Sektion F ------------------
  utilities: [
    { kind: "boingo", id: "boingo-1", x: 1582, y: GROUND_Y - 14 }, // unter F3
    { kind: "boingo", id: "boingo-2", x: 2632, y: GROUND_Y - 14 }, // unter F5
    { kind: "boingo", id: "boingo-3", x: 5932, y: GROUND_Y - 14 }, // P13, Einstieg in die Kette (Abstand zu K1 wie in levelFive.ts: CHASM_MIN_X-100 -> +160)
    { kind: "boingo", id: "boingo-4", x: 6252, y: CHAIN_Y - 14 }, // K1 -> K2
    { kind: "boingo", id: "boingo-5", x: 6652, y: CHAIN_Y - 14 }, // K2 -> K3
  ],
};
