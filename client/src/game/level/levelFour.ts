import type { LevelDef } from "./types";

/**
 * Viertes Level – "Underground" (Redesign, siehe `.features/level-four-redesign/`).
 *
 * Ziel: SMB-1-2-treues Farbschema (schwarzer Hintergrund + blau getönte
 * Stein-Tiles) UND ein eigenständiges Layout mit der Decke als Spielelement.
 *
 * Physik-Grundlage (korrigiert, siehe `.features/level-four-redesign/design.md`):
 * - Basissprung:   560² / 1800 ≈ 174px
 * - Sprint-Sprung: 650² / 1800 ≈ 235px
 * - Boingo:        820² / 1800 ≈ 374px
 * - Spieler-Hitbox: 24×32 (32px Höhe relevant für Kopffreiheit)
 *
 * Deckenhöhen:
 * - LOW    (64px):  Kriechgang – Springen bringt nichts, nur Loderix erlaubt.
 * - NORMAL (272px): Standardpassagen – Sprint-Sprung (235+32=267px) passt.
 * - HIGH   (400px): Boingo-Schacht – Platz für Boingo-Sprung + Alkove.
 *
 * Sektionsübersicht (jede Deckensektion deckt lückenlos ab):
 *   S1 Eingang            x=0..560    NORMAL
 *   S2 Kriechgang 1       x=560..880  LOW
 *   S3 Stalaktiten-Halle  x=880..1520 NORMAL
 *   S4 Boingo-Schacht     x=1520..1760 HIGH
 *   S5 Zwei-Ebenen-Passage x=1760..2320 NORMAL
 *   S6 Kriechgang 2       x=2320..2560 LOW
 *   S7 Zielgerade         x=2560..2800 NORMAL
 *
 * Bodensegmente (Lücken: 112/144/160/128/160 → 4 verschiedene Breiten, ≤170px):
 *   G1 0..352, G2 464..880, G3 1024..1280, G4 1440..1840, G5 1968..2128, G6 2288..2800.
 */
export const GROUND_Y = 500;

/** Kriechzone: Springen bringt nichts (nur ~32px Kopffreiheit). */
export const CLEARANCE_LOW = 64;
/** Normale Passage: auch ein Sprint-Sprung (≈235px + 32px Hitbox = 267px) passt darunter. */
export const CLEARANCE_NORMAL = 272;
/** Boingo-Schacht: Platz für den Trampolin-Sprung (≈374px + 32px Hitbox). */
export const CLEARANCE_HIGH = 400;

const CEILING_Y_LOW = GROUND_Y - CLEARANCE_LOW;
const CEILING_Y_NORMAL = GROUND_Y - CLEARANCE_NORMAL;
const CEILING_Y_HIGH = GROUND_Y - CLEARANCE_HIGH;

export const LEVEL_FOUR: LevelDef = {
  worldWidth: 2800,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 2700, y: GROUND_Y - 16 },
  backgroundKey: "underground",
  terrainStyleKey: "underground",

  // --- Bodensegmente (variierende Lücken, kein Level-3-Klon) ---------------
  // G1: 0-352   G2: 464-880   G3: 1024-1280   G4: 1440-1840   G5: 1968-2128   G6: 2288-2800
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 22 }, // G1: Start
    { x: 464, y: GROUND_Y, tilesWide: 26 }, // G2: Kriechgang 1 + Stalaktiten-Einstieg
    { x: 1024, y: GROUND_Y, tilesWide: 16 }, // G3: nach Checkpoint 1
    { x: 1440, y: GROUND_Y, tilesWide: 25 }, // G4: Boingo-Schacht
    { x: 1968, y: GROUND_Y, tilesWide: 10 }, // G5: obere Route über Lücke 5
    { x: 2288, y: GROUND_Y, tilesWide: 32 }, // G6: Kriechgang 2 + Zielgerade

    // --- Deckensegmente: eigene Sektionierung, entkoppelt vom Boden ---
    // S1 Eingang          0-560   (35 tiles)  NORMAL
    // S2 Kriechgang 1     560-880 (20 tiles)  LOW
    // S3 Stalaktiten-Halle 880-1520 (40 tiles) NORMAL
    // S4 Boingo-Schacht   1520-1760 (15 tiles) HIGH
    // S5 Zwei-Ebenen-Passage 1760-2320 (35 tiles) NORMAL
    // S6 Kriechgang 2     2320-2560 (15 tiles) LOW
    // S7 Zielgerade       2560-2800 (15 tiles) NORMAL
    { x: 0, y: CEILING_Y_NORMAL, tilesWide: 35, kind: "ceiling" },
    { x: 560, y: CEILING_Y_LOW, tilesWide: 20, kind: "ceiling" },
    { x: 880, y: CEILING_Y_NORMAL, tilesWide: 40, kind: "ceiling" },
    { x: 1520, y: CEILING_Y_HIGH, tilesWide: 15, kind: "ceiling" },
    { x: 1760, y: CEILING_Y_NORMAL, tilesWide: 35, kind: "ceiling" },
    { x: 2320, y: CEILING_Y_LOW, tilesWide: 15, kind: "ceiling" },
    { x: 2560, y: CEILING_Y_NORMAL, tilesWide: 15, kind: "ceiling" },

    // --- Schwebeplattformen (obere Route + Boingo-Alkove) ---
    { x: 1856, y: 370, tilesWide: 5, kind: "float" }, // F1: obere Route über Lücke 4
    { x: 2032, y: 370, tilesWide: 5, kind: "float" }, // F2: Zwischenschritt
    { x: 2144, y: 370, tilesWide: 6, kind: "float" }, // F3: obere Route über Lücke 5
    { x: 1600, y: 240, tilesWide: 5, kind: "float" }, // F4: Alkove im Boingo-Schacht
  ],

  // --- Sichtbare Münzen (14) ------------------------------------------
  coins: [
    { id: "coin-1", x: 150, y: 452, fruit: "cherries" }, // G1
    { id: "coin-2", x: 300, y: 452, fruit: "strawberry" }, // G1
    { id: "coin-3", x: 500, y: 452, fruit: "apple" }, // G1/G2 Übergang
    { id: "coin-4", x: 700, y: 470, fruit: "orange" }, // S2 Kriechgang
    { id: "coin-5", x: 840, y: 470, fruit: "kiwi" }, // S2 Kriechgang
    { id: "coin-6", x: 1080, y: 452, fruit: "bananas" }, // S3
    { id: "coin-7", x: 1260, y: 452, fruit: "melon" }, // S3
    { id: "coin-8", x: 1480, y: 452, fruit: "cherries" }, // S3
    { id: "coin-9", x: 1640, y: 200, fruit: "pineapple" }, // F4 Alkove (nur Boingo)
    { id: "coin-10", x: 1890, y: 330, fruit: "apple" }, // F1 obere Route
    { id: "coin-11", x: 2000, y: 452, fruit: "orange" }, // S5
    { id: "coin-12", x: 2180, y: 330, fruit: "kiwi" }, // F3 obere Route
    { id: "coin-13", x: 2400, y: 470, fruit: "strawberry" }, // S6 Kriechgang
    { id: "coin-14", x: 2650, y: 452, fruit: "cherries" }, // S7 Zielgerade
  ],

  // --- Versteckte Blöcke (4) --------------------------------------------
  hiddenCoinBlocks: [
    { id: "block-1", x: 220, y: 436, fruit: "kiwi" }, // G1
    { id: "block-2", x: 1120, y: 436, fruit: "melon" }, // S3
    { id: "block-3", x: 1560, y: 436, fruit: "orange" }, // S5 (nach Boingo-Schacht)
    { id: "block-4", x: 2620, y: 436, fruit: "pineapple" }, // S7
  ],

  // --- Checkpoints (4) --------------------------------------------------
  checkpoints: [
    { id: "checkpoint-1", x: 1024, y: GROUND_Y - 0 }, // nach Kriechgang 1
    { id: "checkpoint-2", x: 1460, y: GROUND_Y - 0 }, // nach Stalaktiten-Halle
    { id: "checkpoint-3", x: 1980, y: GROUND_Y - 0 }, // nach Boingo-Schacht
    { id: "checkpoint-4", x: 2600, y: GROUND_Y - 0 }, // nach Kriechgang 2
  ],

  // --- Hazards (8: mehr als L3/6, weniger als L2/10) --------------------
  hazards: [
    {
      kind: "ninjafrog",
      id: "ninjafrog-1",
      x: 120,
      y: GROUND_Y - 16,
      minX: 120,
      maxX: 320,
      speed: 70,
    },
    {
      kind: "loderix",
      id: "loderix-1",
      x: 640,
      y: GROUND_Y - 16,
      onMs: 1100,
      offMs: 1900,
      phaseMs: 0,
    },
    {
      kind: "loderix",
      id: "loderix-2",
      x: 800,
      y: GROUND_Y - 16,
      onMs: 1100,
      offMs: 1900,
      phaseMs: 1500,
    },
    {
      kind: "spikehead",
      id: "spikehead-1",
      x: 1100,
      originY: CEILING_Y_NORMAL + 16,
      fallToY: GROUND_Y - 16,
      triggerMinX: 1030,
      triggerMaxX: 1100,
    },
    {
      kind: "spikehead",
      id: "spikehead-2",
      x: 1240,
      originY: CEILING_Y_NORMAL + 16,
      fallToY: GROUND_Y - 16,
      triggerMinX: 1170,
      triggerMaxX: 1240,
    },
    {
      kind: "schnetzler",
      id: "schnetzler-1",
      x: 2000,
      y: GROUND_Y - 16,
      minX: 1990,
      maxX: 2110,
      speed: 75,
    },
    {
      kind: "loderix",
      id: "loderix-3",
      x: 2420,
      y: GROUND_Y - 16,
      onMs: 1200,
      offMs: 1400,
      phaseMs: 0,
    },
  ],

  // --- Utilities --------------------------------------------------------
  utilities: [{ kind: "boingo", id: "boingo-1", x: 1640, y: GROUND_Y - 14 }],
};
