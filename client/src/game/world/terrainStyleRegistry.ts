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
  underground: {
    frames: STONE_TERRAIN_TILES,
    /** SMB-1-2-Underground-Cyanblau. Phasers `setTint` wirkt multiplikativ;
     *  die grauen STONE_TERRAIN_TILES sind farbneutral und nehmen den
     *  Blau-Tint deshalb sauber an, ohne in Dunkelheit zu laufen. */
    tint: 0x4a8cff,
  },
  /** Warm-wüstiger Sandton. Angewendet auf das Standard-Gras/Erd-Set,
   *  das durch den multiplikativen Phaser-Tint ins Gelbliche verschoben
   *  wird (siehe `.features/level-five-desert/design.md`). */
  desert: { tint: 0xe8c27a },
  /** Helles Eis-/Schnee-Weiß. Ein reiner Tint auf dem Gras/Erd-Set könnte das
   *  satte Grün nicht wegdrücken (multiplikatives `setTint` kann nur
   *  abdunkeln, nie neutralisieren) - deshalb wie `underground` das
   *  neutral-graue `STONE_TERRAIN_TILES`-Set, das einen blassen Tint sauber
   *  annimmt und wie schneebedeckter Stein statt eingefärbtem Gras wirkt
   *  (siehe `.features/level-six-frost/design.md`, Korrektur nach
   *  Nutzer-Feedback). */
  ice: { frames: STONE_TERRAIN_TILES, tint: 0xeaf6ff },
};

export const DEFAULT_TERRAIN_STYLE_KEY = "default";
