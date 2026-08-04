/**
 * Pure Tile-Ableitung aus der Level-Geometrie – siehe
 * `.features/level-one-arena/design.md`, Abschnitt "level/tiles.ts".
 *
 * Kein vorab berechnetes Grid: Tile-Typ wird pro Zelle on demand aus der
 * Plattform-Geometrie + dynamischem Zustand abgeleitet (KISS).
 */
import type { HazardKind, TileType } from "@arena/bot-contract";
import { isTimedActive } from "../hazards/behaviors";
import type { HazardInstanceDef, LevelDef } from "./types";

export const TILE_SIZE = 16;

export interface DynamicTileState {
  /** IDs aktuell aktiver (gefährlicher) Hazards. */
  activeHazardIds: ReadonlySet<string>;
  /** IDs bereits ausgelöster (zu Münzen gewordener) Blöcke. */
  resolvedBlockIds: ReadonlySet<string>;
}

/**
 * Racer-Zustand wird hier bewusst NICHT als voller `RacerRuntimeState`
 * importiert (ISP): Diese Funktion braucht ausschließlich
 * `resolvedBlockIds`, keine weiteren Racer-Felder.
 */
export interface ResolvedBlocksSource {
  resolvedBlockIds: ReadonlySet<string>;
}

/**
 * Leitet `DynamicTileState` jeden Tick neu ab (nie eigenständig gespeichert,
 * siehe design.md "Drift-Schutz"): `activeHazardIds` rein aus
 * `(level.hazards, elapsedMs)`, `resolvedBlockIds` 1:1 aus
 * `racer.resolvedBlockIds`.
 */
export function buildDynamicTileState(
  level: LevelDef,
  racer: ResolvedBlocksSource,
  elapsedMs: number
): DynamicTileState {
  const activeHazardIds = new Set<string>();
  for (const hazard of level.hazards) {
    if (isHazardActive(hazard, elapsedMs)) {
      activeHazardIds.add(hazard.id);
    }
  }
  return { activeHazardIds, resolvedBlockIds: racer.resolvedBlockIds };
}

function isHazardActive(hazard: HazardInstanceDef, elapsedMs: number): boolean {
  if (hazard.kind === "loderix") {
    return isTimedActive(hazard, elapsedMs);
  }
  // schnetzler/stachlinger/kugelblitz sind laut docs/08 dauerhaft gefährlich.
  return true;
}

function tileSizeToCol(x: number): number {
  return Math.floor(x / TILE_SIZE);
}

function tileSizeToRow(y: number): number {
  return Math.floor(y / TILE_SIZE);
}

/**
 * Fail-Fast-Kette (analog `validateBotModule`): aktiver Hazard? -> "hazard";
 * unresolved Block? -> "coinBlock"; Ziel? -> "goal"; innerhalb einer
 * Plattform? -> "solid"; sonst "empty".
 */
export function tileTypeAt(
  level: LevelDef,
  col: number,
  row: number,
  dynamic: DynamicTileState
): TileType {
  for (const hazard of level.hazards) {
    if (!dynamic.activeHazardIds.has(hazard.id)) continue;
    const hx = hazard.kind === "kugelblitz" ? hazard.pivotX : hazard.x;
    const hy = hazard.kind === "kugelblitz" ? hazard.pivotY : hazard.y;
    if (tileSizeToCol(hx) === col && tileSizeToRow(hy) === row) {
      return "hazard";
    }
  }

  for (const block of level.hiddenCoinBlocks) {
    if (dynamic.resolvedBlockIds.has(block.id)) continue;
    if (tileSizeToCol(block.x) === col && tileSizeToRow(block.y) === row) {
      return "coinBlock";
    }
  }

  if (tileSizeToCol(level.goal.x) === col && tileSizeToRow(level.goal.y) === row) {
    return "goal";
  }

  for (const platform of level.platforms) {
    const startCol = tileSizeToCol(platform.x);
    const endCol = startCol + platform.tilesWide - 1;
    const platformRow = tileSizeToRow(platform.y);
    if (col >= startCol && col <= endCol && row === platformRow) {
      return "solid";
    }
  }

  return "empty";
}

export function buildNearbyTiles(
  level: LevelDef,
  dynamic: DynamicTileState,
  centerCol: number,
  centerRow: number,
  width = 7,
  height = 5
): TileType[][] {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const grid: TileType[][] = [];
  for (let r = 0; r < height; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < width; c++) {
      const col = centerCol - halfWidth + c;
      const rowIndex = centerRow - halfHeight + r;
      row.push(tileTypeAt(level, col, rowIndex, dynamic));
    }
    grid.push(row);
  }
  return grid;
}

// Re-Export für Konsumenten, die nur den Kind-Typ brauchen.
export type { HazardKind };
