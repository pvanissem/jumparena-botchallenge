import type { LevelDef } from "./types";

/**
 * Drittes Level – "Night" (siehe `.features/level-three-underground/`).
 *
 * Baut auf denselben Bewegungswerten wie `LEVEL_ONE`/`LEVEL_TWO` auf
 * (`MOVE_SPEED=200`, `JUMP_VELOCITY=-560`, Gravity=900 aus `RaceScene.ts`:
 * max. Sprunghöhe ≈174px, max. Sprungweite ≈250px), ist aber bewusst
 * spürbar LEICHTER als `LEVEL_TWO` (angelehnt an dessen Hindernis-Typen,
 * jedoch entschärft):
 * - Boden-Lücken sind durchgehend 128px (wie `LEVEL_ONE`, nicht enger als
 *   das, aber klar komfortabler als `LEVEL_TWO`s 176-208px).
 * - Schnetzler treten nur einzeln auf (kein Mehrfach-Gauntlet), mit
 *   niedrigerer Patrol-Geschwindigkeit (60-70 statt 70-90).
 * - Ein einzelner Loderix mit längerer "aus"-Phase (mehr sichere
 *   Durchlaufzeit pro Zyklus) statt eines phasenversetzten Duos.
 * - Ein einzelner Spikehead mit entschärften Timings (mehr Vorwarnzeit,
 *   kürzere Liegedauer).
 * - Kein Kugelblitz (Pendel-Hazard bewusst ausgelassen, siehe design.md).
 * - Dunkler, höhlenartiger Hintergrund (`backgroundKey: "night"`) und
 *   dunkles Terrain (`terrainStyleKey: "night"`), siehe
 *   `world/proceduralBackgrounds.ts` / `world/terrainStyleRegistry.ts`.
 */
const GROUND_Y = 500;

export const LEVEL_THREE: LevelDef = {
  worldWidth: 2700,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 2470, y: GROUND_Y - 16 },
  backgroundKey: "night",
  terrainStyleKey: "night",

  // --- Bodensegmente ------------------------------------------------
  // P1: 0-320       P2: 448-704      P3: 832-1120
  // P4: 1248-1520   P5: 1648-1968    P6: 2096-2560
  // Alle Lücken exakt 128px.
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 20 }, // P1: Start
    { x: 448, y: GROUND_Y, tilesWide: 16 }, // P2: erster Schnetzler
    { x: 832, y: GROUND_Y, tilesWide: 18 }, // P3: Stachlinger + Spikehead
    { x: 1248, y: GROUND_Y, tilesWide: 17 }, // P4: Loderix
    { x: 1648, y: GROUND_Y, tilesWide: 20 }, // P5: zweiter Schnetzler + Boingo-Bereich
    { x: 2096, y: GROUND_Y, tilesWide: 29 }, // P6: zweiter Stachlinger + Zielgerade

    // --- Schwebeplattform (Bonus-Route, normal erreichbar) ---
    { x: 300, y: GROUND_Y - 170, tilesWide: 3, kind: "float" }, // F1: über Lücke 1
  ],

  // --- Sichtbare Münzen (12) ------------------------------------------
  coins: [
    { id: "coin-1", x: 150, y: GROUND_Y - 48, fruit: "cherries" }, // P1
    { id: "coin-2", x: 500, y: GROUND_Y - 48, fruit: "strawberry" }, // P2
    { id: "coin-3", x: 650, y: GROUND_Y - 48, fruit: "apple" }, // P2
    { id: "coin-4", x: 900, y: GROUND_Y - 48, fruit: "orange" }, // P3
    { id: "coin-5", x: 1050, y: GROUND_Y - 48, fruit: "kiwi" }, // P3
    { id: "coin-6", x: 1300, y: GROUND_Y - 48, fruit: "bananas" }, // P4
    { id: "coin-7", x: 1450, y: GROUND_Y - 48, fruit: "cherries" }, // P4
    { id: "coin-8", x: 1700, y: GROUND_Y - 48, fruit: "apple" }, // P5
    { id: "coin-9", x: 1900, y: GROUND_Y - 48, fruit: "orange" }, // P5
    { id: "coin-10", x: 2200, y: GROUND_Y - 48, fruit: "melon" }, // P6
    { id: "coin-11", x: 2380, y: GROUND_Y - 48, fruit: "cherries" }, // P6
    // Bonus-Plattform:
    { id: "coin-12", x: 316, y: GROUND_Y - 200, fruit: "pineapple" }, // F1
  ],

  // --- Versteckte Blöcke (4) --------------------------------------------
  hiddenCoinBlocks: [
    { id: "block-1", x: 550, y: GROUND_Y - 64, fruit: "kiwi" }, // P2
    { id: "block-2", x: 970, y: GROUND_Y - 64, fruit: "melon" }, // P3
    { id: "block-3", x: 1380, y: GROUND_Y - 64, fruit: "orange" }, // P4
    { id: "block-4", x: 2250, y: GROUND_Y - 64, fruit: "pineapple" }, // P6
  ],

  // --- Checkpoints (3), jeweils nach einer der drei Hazard-Passagen -----
  checkpoints: [
    { id: "checkpoint-1", x: 832, y: GROUND_Y - 0 }, // Start von P3
    { id: "checkpoint-2", x: 1648, y: GROUND_Y - 0 }, // Start von P5
    { id: "checkpoint-3", x: 2096, y: GROUND_Y - 0 }, // Start von P6
  ],

  // --- Hazards (nur bestehende Kinds, entschärft ggü. LEVEL_TWO) --------
  hazards: [
    // Einzelner Schnetzler auf P2 (448-704), langsamer als in LEVEL_TWO.
    {
      kind: "schnetzler",
      id: "schnetzler-1",
      x: 520,
      y: GROUND_Y - 16,
      minX: 520,
      maxX: 620,
      speed: 60,
    },
    // Zweiter, einzelner Schnetzler auf P5 (1648-1968).
    {
      kind: "schnetzler",
      id: "schnetzler-2",
      x: 1720,
      y: GROUND_Y - 16,
      minX: 1720,
      maxX: 1850,
      speed: 65,
    },
    // Stachlinger auf P3 (832-1120) und P6 (2096-2560).
    { kind: "stachlinger", id: "stachlinger-1", x: 900, y: GROUND_Y - 8 },
    { kind: "stachlinger", id: "stachlinger-2", x: 2280, y: GROUND_Y - 8 },
    // Einzelner Loderix auf P4 (1248-1520), längere "aus"-Phase als in
    // LEVEL_TWO (onMs 1500/offMs 1500) - mehr sichere Durchlaufzeit.
    { kind: "loderix", id: "loderix-1", x: 1380, y: GROUND_Y - 16, onMs: 900, offMs: 1800 },
    // Spikehead auf P3 (832-1120): entschärfte Timings (mehr Vorwarnzeit,
    // kürzere Liegedauer als LEVEL_TWO-Default warnMs=400/restMs=600).
    {
      kind: "spikehead",
      id: "spikehead-1",
      x: 1000,
      originY: GROUND_Y - 200,
      fallToY: GROUND_Y - 16,
      triggerMinX: 970,
      triggerMaxX: 1030,
      warnMs: 700,
      restMs: 400,
    },
    // Kein Kugelblitz (siehe design.md - bewusst ausgelassen für ein
    // leichteres Level).
  ],

  // --- Utilities: ein Boingo unter der Bonus-Plattform F1 ---------------
  utilities: [{ kind: "boingo", id: "boingo-1", x: 316, y: GROUND_Y - 14 }],
};
