/**
 * Pure Abgrund-Erkennung in Blickrichtung – liefert dem Bot ein einfaches
 * "kommt bald eine Lücke?"-Signal, ohne dass er das `nearbyTiles`-Raster selbst
 * parsen muss (siehe `.features/bot-state-vision/design.md`, US-6). Arbeitet nur
 * auf der Plattform-Geometrie (`isSolidAt`), keine Phaser-Abhängigkeit.
 */

import type { GapAhead } from "@arena/bot-contract";
import { isSolidAt, TILE_SIZE } from "../level/tiles";
import type { LevelDef } from "../level/types";
import { VIEW_HALF_WIDTH_PX } from "./viewport";

/**
 * Schreitet ab der Bot-Spalte Tile für Tile in `facing`-Richtung (bis
 * `maxDistancePx`) und sucht die erste Spalte, unter der KEIN solides Boden-Tile
 * liegt ("Bodenzeile" = ein Tile unter der Bot-Mitte). `distance` ist die
 * horizontale Pixel-Distanz von der Bot-x-Position bis zur (in Laufrichtung)
 * zugewandten Kante dieses Lücken-Tiles, immer >= 0.
 */
export function computeGapAhead(
  level: LevelDef,
  x: number,
  y: number,
  facing: "left" | "right",
  maxDistancePx = VIEW_HALF_WIDTH_PX
): GapAhead {
  const step = facing === "right" ? 1 : -1;
  const botCol = Math.floor(x / TILE_SIZE);
  const groundRow = Math.floor(y / TILE_SIZE) + 1;
  const maxCols = Math.floor(maxDistancePx / TILE_SIZE);

  for (let i = 0; i <= maxCols; i++) {
    const col = botCol + i * step;
    if (isSolidAt(level, col, groundRow)) continue;

    // Erste Spalte ohne Boden darunter -> Lücke. Kante in Laufrichtung:
    // rechts -> linke Kante (col*TILE); links -> rechte Kante (col*TILE + TILE-1).
    const edgeX = facing === "right" ? col * TILE_SIZE : col * TILE_SIZE + TILE_SIZE - 1;
    const distance = Math.max(0, facing === "right" ? edgeX - x : x - edgeX);
    return { present: true, distance };
  }

  return { present: false, distance: null };
}
