/**
 * Zentrale Zuordnung `terrainStyleKey -> TerrainStyleSpec` – siehe
 * `.features/level-three-underground/design.md`. Neuer Terrain-Style = neuer
 * Eintrag hier, `worldBuilder.ts` verzweigt nie selbst nach `terrainStyleKey`
 * (Open/Closed, analog `world/backgroundRegistry.ts`).
 *
 * Reine Konstanten-Deklaration ohne Verzweigungslogik – kein eigener Test
 * für die Anwendung nötig (siehe design.md, Test-Strategie); die Registry
 * selbst wird über `terrainStyleRegistry.test.ts` abgesichert.
 */
import { STONE_TERRAIN_TILES } from "../assets/spriteSheets";
export interface TerrainFrameSet {
  topLeft: number;
  topMid: number;
  topRight: number;
  midLeft: number;
  midMid: number;
  midRight: number;
}

export interface TerrainStyleSpec {
  /** Phaser-Tint-Farbwert (0xRRGGBB), angewendet auf jedes Terrain-Tile-Image.
   *  `undefined` = keine Einfärbung (Original-Optik). */
  tint?: number;
  /** Alternatives Frame-Set aus dem Terrain-Tileset (statt Tint auf `TERRAIN_TILES`).
   *  `undefined` = Default `TERRAIN_TILES` (bestehendes Gras/Erd-Set). */
  frames?: TerrainFrameSet;
}

export const TERRAIN_STYLE_REGISTRY: Record<string, TerrainStyleSpec> = {
  default: {}, // keine Einfärbung - bestehendes helles Terrain
  night: { tint: 0x4a4a63 }, // dunkles Blaugrau, höhlenartig
  underground: { frames: STONE_TERRAIN_TILES }, // echte graue Stein-Tiles (siehe design.md)
};

export const DEFAULT_TERRAIN_STYLE_KEY = "default";
