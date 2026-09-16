/**
 * Momentaufnahme der Welt für einen Tick – siehe
 * `.features/level-one-arena/design.md`, Abschnitt "state/worldSnapshot.ts".
 * Reine Daten, keine Phaser-Typen.
 */
import type { HazardKind, UtilityKind } from "@arena/bot-contract";
import type { DynamicTileState } from "../level/tiles";
import type { LevelDef } from "../level/types";

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type { NavigationObservation } from "@arena/bot-contract";

export interface WorldSnapshot {
  levelId?: string;
  level: LevelDef;
  dynamic: DynamicTileState;
  goalBounds?: WorldRect;
  visibleCoins: ReadonlyArray<{
    id: string;
    x: number;
    y: number;
    value: number;
    bounds?: WorldRect;
  }>;
  hazards: ReadonlyArray<{
    id: string;
    kind: HazardKind;
    x: number;
    y: number;
    bounds?: WorldRect;
    active: boolean;
    /** Ob sich die Gefahr gerade ankündigt (Spikehead-Vorwarnphase). */
    warning: boolean;
    /** Aktuelle Geschwindigkeit (px/s), aus der Positionsänderung zwischen
     *  zwei Ticks abgeleitet (siehe `hazardVelocity.ts`). Optional/undefined
     *  vor der Verdrahtung in `RaceScene` (US-7) – `botStateBuilder`
     *  behandelt das als `0`. */
    vx?: number;
    vy?: number;
  }>;
  utilities: ReadonlyArray<{
    id: string;
    kind: UtilityKind;
    x: number;
    y: number;
    bounds?: WorldRect;
  }>;
}
