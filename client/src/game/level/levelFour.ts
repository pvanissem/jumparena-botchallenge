import type { LevelDef } from "./types";

/**
 * Viertes Level – "Underground" (siehe `.features/level-four-underground/`).
 *
 * Anders als `LEVEL_THREE` ("Night", nur Boden + Tint) ist dies das erste Level mit einem
 * durchgehend geschlossenen Korridor (Boden UND Decke) und echten grauen Stein-Tiles statt
 * eingefärbter Gras-Tiles (siehe `assets/spriteSheets.ts#STONE_TERRAIN_TILES`,
 * `world/terrainStyleRegistry.ts`). Hintergrund ist an das klassische Untergrund-Level 1-2 aus
 * Super Mario Bros. angelehnt (siehe `world/proceduralBackgrounds.ts`).
 *
 * Baut auf denselben Bewegungswerten wie `LEVEL_ONE`-`LEVEL_THREE` auf (`MOVE_SPEED=200`,
 * `JUMP_VELOCITY=-560`, Gravity=900 aus `RaceScene.ts`: max. Sprunghöhe ≈174px). Boden-Lücken
 * sind wie bei `LEVEL_THREE` durchgehend 128px (komfortabel) - das Level ist primär thematisch,
 * nicht als Schwierigkeitssteigerung gedacht.
 */
export const GROUND_Y = 500;

/**
 * Lichte Korridorhöhe (Boden-Oberkante bis Decken-Unterkante) = 14 Tiles = 224px. Herleitung
 * (siehe design.md): max. Sprunghöhe ≈174px + Spieler-Hitbox 32px = 206px < 224px, lässt
 * Sicherheitsabstand für reguläre Sprünge ohne zwingenden Kopfstoß.
 */
export const CEILING_CLEARANCE = 224;
const CEILING_Y = GROUND_Y - CEILING_CLEARANCE;

export const LEVEL_FOUR: LevelDef = {
  worldWidth: 2700,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 80 },
  goal: { x: 2470, y: GROUND_Y - 16 },
  backgroundKey: "underground",
  terrainStyleKey: "underground",

  // --- Bodensegmente (128px-Lücken, wie LEVEL_THREE) -----------------------
  // P1: 0-320       P2: 448-704      P3: 832-1120
  // P4: 1248-1520   P5: 1648-1968    P6: 2096-2560
  // Jedes Boden-Segment bekommt ein deckungsgleiches Decken-Segment (siehe unten).
  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 20 }, // P1: Start
    { x: 448, y: GROUND_Y, tilesWide: 16 }, // P2: Schnetzler
    { x: 832, y: GROUND_Y, tilesWide: 18 }, // P3: Stachlinger
    { x: 1248, y: GROUND_Y, tilesWide: 17 }, // P4: Loderix
    { x: 1648, y: GROUND_Y, tilesWide: 20 }, // P5: zweiter Schnetzler
    { x: 2096, y: GROUND_Y, tilesWide: 29 }, // P6: zweiter Stachlinger + Zielgerade

    // --- Deckensegmente: deckungsgleich zu den Bodensegmenten, geschlossener Korridor ---
    { x: 0, y: CEILING_Y, tilesWide: 20, kind: "ceiling" },
    { x: 448, y: CEILING_Y, tilesWide: 16, kind: "ceiling" },
    { x: 832, y: CEILING_Y, tilesWide: 18, kind: "ceiling" },
    { x: 1248, y: CEILING_Y, tilesWide: 17, kind: "ceiling" },
    { x: 1648, y: CEILING_Y, tilesWide: 20, kind: "ceiling" },
    { x: 2096, y: CEILING_Y, tilesWide: 29, kind: "ceiling" },
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
    { id: "coin-12", x: 2300, y: GROUND_Y - 48, fruit: "pineapple" }, // P6
  ],

  // --- Versteckte Blöcke (4) --------------------------------------------
  hiddenCoinBlocks: [
    { id: "block-1", x: 550, y: GROUND_Y - 64, fruit: "kiwi" }, // P2
    { id: "block-2", x: 970, y: GROUND_Y - 64, fruit: "melon" }, // P3
    { id: "block-3", x: 1380, y: GROUND_Y - 64, fruit: "orange" }, // P4
    { id: "block-4", x: 2250, y: GROUND_Y - 64, fruit: "pineapple" }, // P6
  ],

  // --- Checkpoints (3), jeweils nach einer der Hazard-Passagen -----------
  checkpoints: [
    { id: "checkpoint-1", x: 832, y: GROUND_Y - 0 }, // Start von P3
    { id: "checkpoint-2", x: 1648, y: GROUND_Y - 0 }, // Start von P5
    { id: "checkpoint-3", x: 2096, y: GROUND_Y - 0 }, // Start von P6
  ],

  // --- Hazards (nur bestehende Kinds, kein Spikehead - siehe design.md) -----
  hazards: [
    // Einzelner Schnetzler auf P2 (448-704).
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
    // Einzelner Loderix auf P4 (1248-1520), großzügige "aus"-Phase.
    { kind: "loderix", id: "loderix-1", x: 1380, y: GROUND_Y - 16, onMs: 900, offMs: 1800 },
  ],

  utilities: [],
};
