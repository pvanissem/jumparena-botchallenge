/**
 * Momentaufnahme der Welt für einen Tick – siehe
 * `.features/level-one-arena/design.md`, Abschnitt "state/worldSnapshot.ts".
 * Reine Daten, keine Phaser-Typen.
 */
import type { HazardKind, UtilityKind } from "@arena/bot-contract";
import type { DynamicTileState } from "../level/tiles";
import type { LevelDef } from "../level/types";

export interface WorldSnapshot {
  level: LevelDef;
  dynamic: DynamicTileState;
  visibleCoins: ReadonlyArray<{ id: string; x: number; y: number; value: number }>;
  hazards: ReadonlyArray<{ id: string; kind: HazardKind; x: number; y: number; active: boolean }>;
  utilities: ReadonlyArray<{ id: string; kind: UtilityKind; x: number; y: number }>;
}
