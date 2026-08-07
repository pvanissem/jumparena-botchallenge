import type { LevelDef } from "./types";

/**
 * Reine Testumgebung für das bot-toolkit (`.features/bot-toolkit/`).
 *
 * AKTUELLES SZENARIO: die vier zuletzt noch unverifizierten Utilities.
 *
 *   1) Lücke auf gleicher Höhe   -> `simulateJump` (landet der Sprung drüben?)
 *   2) Stufe 100px nach OBEN     -> `apex`         (kommt der Sprung hoch genug?)
 *   3) Abbruchkante ohne Ziel    -> `surfaceAt`    (ist da überhaupt Boden?)
 *                                   `ticksUntilEdge` (wann verlasse ich die Platte?)
 *
 * Erfolgskriterium: Der Bot überspringt beide Lücken, kommt auf die höhere
 * Plattform und bleibt am Ende an der Abbruchkante stehen, statt hinunterzu-
 * laufen. Das Ziel liegt bewusst hinter der Kante und ist NICHT erreichbar -
 * ein Bot, der die Kante nicht erkennt, stürzt sichtbar ab.
 *
 * Layout (x-Bereich | Höhe):
 *   P1     0- 320  y=500   Start / Anlauf
 *   Lücke 320- 416 (96px, gleiche Höhe)
 *   P2   416- 700  y=500
 *   Lücke 700- 780 (80px, dahinter 100px HÖHER)
 *   P3   780-1120  y=400
 *   Kante bei 1120 - dahinter nichts mehr.
 */
const GROUND_Y = 500;

export const LEVEL_TOOLKIT_TEST: LevelDef = {
  worldWidth: 1400,
  worldHeight: 540,
  groundY: GROUND_Y,
  spawn: { x: 48, y: GROUND_Y - 80 },
  goal: { x: 1300, y: GROUND_Y - 16 }, // hinter der Kante - bewusst unerreichbar

  platforms: [
    { x: 0, y: GROUND_Y, tilesWide: 20 }, // P1: 0-320
    { x: 416, y: GROUND_Y, tilesWide: 18 }, // P2: 416-704
    { x: 780, y: GROUND_Y - 100, tilesWide: 21 }, // P3: 780-1116, 100px höher
  ],

  coins: [],
  hiddenCoinBlocks: [],
  checkpoints: [],
  hazards: [],
  utilities: [],
};
