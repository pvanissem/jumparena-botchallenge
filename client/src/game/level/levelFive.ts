import type { LevelDef } from "./types";

/**
 * Fünftes Level – "Desert" (siehe `.features/level-five-desert/`).
 *
 * Ziel: ein leicht bis mittel schweres Wüsten-Level, das zwei neue
 * Strukturelemente einführt, ohne die Bot-API zu erweitern:
 *   1. eine zwingend per Trampolin-Kette zu überwindende Abgrund-Passage
 *      ("Großer Graben"),
 *   2. eine echte Routenwahl (sichere Bodenroute vs. ertragreiche Hochroute).
 *
 * Physik-Grundlage (siehe `docs/02-bot-api.md` und
 * `.features/level-five-desert/design.md`):
 * - Gravitation:           900 px/s²
 * - Basis-/Sprint-Tempo:   200 / 320 px/s
 * - Basis-/Sprint-Sprung:  560 / 650 px/s   -> max. Höhe 174 / 235 px
 * - Boingo-Absprung:       820 px/s         -> max. Höhe ≈ 373 px
 *
 * Layout (`x`-Werte in px, Tiles 16×16):
 *
 *   y=200  ............................  [K1]       [K2]       [K3]
 *   y=330  ..... [H1][H2][H3][H4] .................................
 *   y=500  [==G1==]  [====G2====]  [==G3==]      GRABEN      [==G4==]  [==G5==]
 *          0    352  480      864  1008  1280    1280-2480   2480 2800 2880 3120
 *
 * - G1..G5:  Bodensegmente
 * - H1..H4:  optionale Hochroute (y = HIGH_ROUTE_Y)
 * - K1..K3:  Pflicht-Trampolin-Kette über den Großen Graben (y = CHAIN_Y)
 */
export const GROUND_Y = 500;

/** Höhe der Trampolin-Kettenplattformen über dem unteren Welt-Rand. */
export const CHAIN_Y = 200;

/** Höhe der optionalen Hochroute. 170 px über groundY -> per Basissprung erreichbar. */
export const HIGH_ROUTE_Y = 330;

/** Linke Kante des Großen Grabens (Ende von G3). */
export const CHASM_MIN_X = 1280;

/** Rechte Kante des Großen Grabens (Beginn von G4). */
export const CHASM_MAX_X = 2480;

export const LEVEL_FIVE: LevelDef = {
  worldWidth: 3120,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 3060, y: GROUND_Y - 16 },
  backgroundKey: "desert",
  terrainStyleKey: "desert",

  // --- Bodensegmente ------------------------------------------------------
  // G1: 0-352    G2: 480-864    G3: 1008-1280    G4: 2480-2800    G5: 2880-3120
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 22 }, // G1
    { x: 480, y: GROUND_Y, tilesWide: 24 }, // G2
    { x: 1008, y: GROUND_Y, tilesWide: 17 }, // G3
    { x: 2480, y: GROUND_Y, tilesWide: 20 }, // G4
    { x: 2880, y: GROUND_Y, tilesWide: 15 }, // G5

    // --- Hochroute (y = HIGH_ROUTE_Y) ------------------------------------
    { x: 520, y: HIGH_ROUTE_Y, tilesWide: 6, kind: "float" }, // H1
    { x: 680, y: HIGH_ROUTE_Y, tilesWide: 6, kind: "float" }, // H2
    { x: 840, y: HIGH_ROUTE_Y, tilesWide: 7, kind: "float" }, // H3
    { x: 1010, y: HIGH_ROUTE_Y, tilesWide: 7, kind: "float" }, // H4

    // --- Trampolin-Kette über den Großen Graben (y = CHAIN_Y) -----------
    { x: 1440, y: CHAIN_Y, tilesWide: 12, kind: "float" }, // K1
    { x: 1840, y: CHAIN_Y, tilesWide: 17, kind: "float" }, // K2
    { x: 2224, y: CHAIN_Y, tilesWide: 17, kind: "float" }, // K3
  ],

  // --- Sichtbare Münzen (13) ----------------------------------------------
  coins: [
    { id: "coin-1", x: 150, y: GROUND_Y - 48, fruit: "cherries" }, // G1
    { id: "coin-2", x: 300, y: GROUND_Y - 48, fruit: "strawberry" }, // G1
    { id: "coin-3", x: 600, y: GROUND_Y - 48, fruit: "cherries" }, // G2 – Parallelstrecke
    { id: "coin-4", x: 780, y: GROUND_Y - 48, fruit: "strawberry" }, // G2 – Parallelstrecke
    { id: "coin-5", x: 1060, y: GROUND_Y - 48, fruit: "cherries" }, // G3 – Parallelstrecke
    { id: "coin-6", x: 560, y: HIGH_ROUTE_Y - 48, fruit: "kiwi" }, // H1 – Hochroute
    { id: "coin-7", x: 880, y: HIGH_ROUTE_Y - 48, fruit: "melon" }, // H3 – Hochroute
    { id: "coin-8", x: 1060, y: HIGH_ROUTE_Y - 48, fruit: "pineapple" }, // H4 – Hochroute
    { id: "coin-9", x: 1560, y: CHAIN_Y - 48, fruit: "orange" }, // K1 – Kette
    { id: "coin-10", x: 1960, y: CHAIN_Y - 48, fruit: "orange" }, // K2 – Kette
    { id: "coin-11", x: 2360, y: CHAIN_Y - 48, fruit: "orange" }, // K3 – Kette
    { id: "coin-12", x: 2600, y: GROUND_Y - 48, fruit: "apple" }, // G4
    { id: "coin-13", x: 2960, y: GROUND_Y - 48, fruit: "bananas" }, // G5
  ],

  // --- Versteckte Blöcke (4) ----------------------------------------------
  hiddenCoinBlocks: [
    { id: "block-1", x: 250, y: GROUND_Y - 64, fruit: "kiwi" }, // G1
    { id: "block-2", x: 1120, y: GROUND_Y - 64, fruit: "orange" }, // G3
    { id: "block-3", x: 2650, y: GROUND_Y - 64, fruit: "melon" }, // G4
    { id: "block-4", x: 3000, y: GROUND_Y - 64, fruit: "pineapple" }, // G5
  ],

  // --- Checkpoints (4) ----------------------------------------------------
  checkpoints: [
    { id: "checkpoint-1", x: 520, y: GROUND_Y }, // G2
    { id: "checkpoint-2", x: 1030, y: GROUND_Y }, // G3, direkt vor dem Großen Graben
    { id: "checkpoint-3", x: 2520, y: GROUND_Y }, // G4, direkt nach dem Graben
    { id: "checkpoint-4", x: 2920, y: GROUND_Y }, // G5
  ],

  // --- Hazards (6) --------------------------------------------------------
  hazards: [
    {
      kind: "ninjafrog",
      id: "ninjafrog-1",
      x: 180,
      y: GROUND_Y - 16,
      minX: 140,
      maxX: 320,
      speed: 70,
    }, // G1
    {
      kind: "stachlinger",
      id: "stachlinger-1",
      x: 820,
      y: GROUND_Y - 16,
    }, // G2, Parallelstrecke
    {
      kind: "loderix",
      id: "loderix-1",
      x: 740,
      y: HIGH_ROUTE_Y - 16,
      onMs: 1000,
      offMs: 2000,
    }, // H2 – Hochroute
    {
      kind: "spikehead",
      id: "spikehead-1",
      x: 900,
      originY: 100,
      fallToY: HIGH_ROUTE_Y - 16,
      triggerMinX: 840,
      triggerMaxX: 900,
      warnMs: 600,
      fallMs: 200,
      restMs: 400,
      riseMs: 500,
    }, // H3 – Hochroute
    {
      kind: "ninjafrog",
      id: "ninjafrog-2",
      x: 2560,
      y: GROUND_Y - 16,
      minX: 2500,
      maxX: 2700,
      speed: 65,
    }, // G4
    {
      kind: "stachlinger",
      id: "stachlinger-2",
      x: 2960,
      y: GROUND_Y - 16,
    }, // G5
  ],

  // --- Utilities ----------------------------------------------------------
  utilities: [
    { kind: "boingo", id: "boingo-1", x: 1180, y: GROUND_Y - 14 }, // Einstieg in die Kette
    { kind: "boingo", id: "boingo-2", x: 1500, y: CHAIN_Y - 14 }, // K1 -> K2
    { kind: "boingo", id: "boingo-3", x: 1900, y: CHAIN_Y - 14 }, // K2 -> K3
    // K3 trägt bewusst kein Boingo; Ausstieg durch Herunterlaufen auf G4.
  ],
};
