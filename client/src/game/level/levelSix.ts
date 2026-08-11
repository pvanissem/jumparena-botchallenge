import type { LevelDef } from "./types";

/**
 * Sechstes Level – "Frost" (siehe `.features/level-six-frost/`).
 *
 * Ziel: ein mittelschweres Eis-/Schnee-Level, das ein neues Struktur-Element
 * einführt, ohne die Bot-API zu erweitern: die "Frost-Gauntlet"-Zone, in der
 * zwei Loderix-Instanzen exakt gegenläufig getaktet sind (zu jedem Zeitpunkt
 * ist genau eine der beiden aktiv) und ein direkt anschließender Spikehead
 * ein zusammenhängendes Timing-Puzzle bildet.
 *
 * Physik-/Timing-Grundlage (siehe `.features/level-six-frost/design.md`):
 * - Sprint-Tempo:            320 px/s
 * - Loderix-Zyklus:          onMs = offMs = 900 -> Zykluslänge 1800 ms
 * - Loderix-2 gegenphasig:   phaseMs = 900 (= halbe Zykluslänge) ->
 *   für jedes t ist Instanz 1 aktiv genau dann, wenn Instanz 2 sicher ist
 *   (algebraischer Beweis in design.md).
 * - Abstand Loderix-1 -> Loderix-2: 384 px (= 320 px/s * 1,2 s), sodass ein
 *   Bot, der Loderix-1 exakt beim Wechsel aktiv->sicher passiert und
 *   durchgehend sprintet, Loderix-2 ebenfalls im sicheren Fenster erreicht.
 * - Spikehead-Trigger-Zone beginnt 20 px nach Loderix-2 (<= 40 px) – ein
 *   kontinuierlich sprintender Bot quert sie noch in der ungefährlichen
 *   "warning"-Phase (Default warnMs=400ms); ein Bot, der dort stehen bleibt,
 *   wird vom fallenden Kopf getroffen (bewusste Design-Falle).
 *
 * Layout (`x`-Werte in px, Tiles 16x16):
 *
 *   y=240                                                          [ALK]
 *   y=500  [==G1==]  [====G2====]  [========G3 (Frost-Gauntlet)========]  [====G4====]
 *          0    320  470       854 1014                             2102  2262    2758
 *              150-Lücke        160-Lücke                                160-Lücke (Kugelblitz)
 *
 * - G1..G4:  Bodensegmente
 * - ALK:     optionale Boingo-Bonus-Alkove
 * - G3 trägt die komplette Frost-Gauntlet-Zone zwischen `checkpoint-2` (1390)
 *   und `checkpoint-3` (1950) ohne Lücke oder Plattform-Wechsel.
 */
export const GROUND_Y = 500;

/** Linke Grenze der Frost-Gauntlet-Zone (= Position von `checkpoint-2`). */
export const GAUNTLET_ZONE_MIN_X = 1390;

/** Rechte Grenze der Frost-Gauntlet-Zone (= Position von `checkpoint-3`). */
export const GAUNTLET_ZONE_MAX_X = 1950;

export const LEVEL_SIX: LevelDef = {
  worldWidth: 2760,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: 420 },
  goal: { x: 2700, y: 484 },
  backgroundKey: "ice",
  terrainStyleKey: "ice",

  // --- Bodensegmente ------------------------------------------------------
  // G1: 0-320    G2: 470-854    G3: 1014-2102 (Frost-Gauntlet)    G4: 2262-2758
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 20 }, // G1
    { x: 470, y: GROUND_Y, tilesWide: 24 }, // G2
    { x: 1014, y: GROUND_Y, tilesWide: 68 }, // G3 – Frost-Gauntlet-Trägerplattform
    { x: 2262, y: GROUND_Y, tilesWide: 31 }, // G4

    // --- Optionale Boingo-Bonus-Alkove (y = 240) -------------------------
    { x: 2320, y: 240, tilesWide: 6, kind: "float" }, // ALK
  ],

  // --- Sichtbare Münzen (12) ----------------------------------------------
  coins: [
    { id: "coin-1", x: 150, y: GROUND_Y - 48, fruit: "cherries" }, // G1
    { id: "coin-2", x: 280, y: GROUND_Y - 48, fruit: "strawberry" }, // G1
    { id: "coin-3", x: 520, y: GROUND_Y - 48, fruit: "cherries" }, // G2
    { id: "coin-4", x: 760, y: GROUND_Y - 48, fruit: "strawberry" }, // G2
    { id: "coin-5", x: 1050, y: GROUND_Y - 48, fruit: "cherries" }, // G3 – vor der Zone
    { id: "coin-6", x: 1200, y: GROUND_Y - 48, fruit: "strawberry" }, // G3 – vor der Zone
    { id: "coin-7", x: 1980, y: GROUND_Y - 48, fruit: "orange" }, // G3 – nach der Zone
    { id: "coin-8", x: 2360, y: 240 - 48, fruit: "pineapple" }, // ALK – Bonus
    { id: "coin-9", x: 2300, y: GROUND_Y - 48, fruit: "apple" }, // G4
    { id: "coin-10", x: 2500, y: GROUND_Y - 48, fruit: "bananas" }, // G4
    { id: "coin-11", x: 2600, y: GROUND_Y - 48, fruit: "kiwi" }, // G4
    { id: "coin-12", x: 2680, y: GROUND_Y - 48, fruit: "cherries" }, // G4
  ],

  // --- Versteckte Blöcke (4) ----------------------------------------------
  hiddenCoinBlocks: [
    { id: "block-1", x: 200, y: GROUND_Y - 64, fruit: "kiwi" }, // G1
    { id: "block-2", x: 650, y: GROUND_Y - 64, fruit: "orange" }, // G2
    { id: "block-3", x: 1150, y: GROUND_Y - 64, fruit: "orange" }, // G3 – vor der Zone
    { id: "block-4", x: 2450, y: GROUND_Y - 64, fruit: "melon" }, // G4
  ],

  // --- Checkpoints (4) ----------------------------------------------------
  checkpoints: [
    { id: "checkpoint-1", x: 500, y: GROUND_Y }, // G2
    { id: "checkpoint-2", x: GAUNTLET_ZONE_MIN_X, y: GROUND_Y }, // G3, unmittelbar vor der Zone
    { id: "checkpoint-3", x: GAUNTLET_ZONE_MAX_X, y: GROUND_Y }, // G3, unmittelbar nach der Zone
    { id: "checkpoint-4", x: 2350, y: GROUND_Y }, // G4
  ],

  // --- Hazards (6) --------------------------------------------------------
  hazards: [
    {
      kind: "ninjafrog",
      id: "ninjafrog-1",
      x: 180,
      y: GROUND_Y - 16,
      minX: 140,
      maxX: 300,
      speed: 70,
    }, // G1
    {
      kind: "stachlinger",
      id: "stachlinger-1",
      x: 680,
      y: GROUND_Y - 16,
    }, // G2
    {
      kind: "loderix",
      id: "loderix-1",
      x: 1400,
      y: GROUND_Y - 16,
      onMs: 900,
      offMs: 900,
      phaseMs: 0,
    }, // G3 – Frost-Gauntlet
    {
      kind: "loderix",
      id: "loderix-2",
      x: 1784,
      y: GROUND_Y - 16,
      onMs: 900,
      offMs: 900,
      phaseMs: 900,
    }, // G3 – Frost-Gauntlet, exakt gegenphasig zu loderix-1
    {
      kind: "spikehead",
      id: "spikehead-1",
      x: 1864,
      originY: 90,
      fallToY: GROUND_Y - 16,
      triggerMinX: 1804,
      triggerMaxX: 1864,
    }, // G3 – Frost-Gauntlet, direkt nach loderix-2
    {
      kind: "kugelblitz",
      id: "kugelblitz-1",
      pivotX: 2182,
      pivotY: 250,
      length: 140,
    }, // über der Lücke G3 -> G4
  ],

  // --- Utilities ------------------------------------------------------------
  utilities: [
    { kind: "boingo", id: "boingo-1", x: 2300, y: GROUND_Y - 14 }, // G4, Zugang zur Alkove
  ],
};
