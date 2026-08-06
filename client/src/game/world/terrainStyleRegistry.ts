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
export interface TerrainStyleSpec {
  /** Phaser-Tint-Farbwert (0xRRGGBB), angewendet auf jedes Terrain-Tile-Image.
   *  `undefined` = keine Einfärbung (Original-Optik). */
  tint?: number;
}

export const TERRAIN_STYLE_REGISTRY: Record<string, TerrainStyleSpec> = {
  default: {}, // keine Einfärbung - bestehendes helles Terrain
  night: { tint: 0x4a4a63 }, // dunkles Blaugrau, höhlenartig
};

export const DEFAULT_TERRAIN_STYLE_KEY = "default";
