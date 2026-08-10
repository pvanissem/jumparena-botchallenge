import type { LevelDef } from "../game/level/types";
import type { RacerRuntimeState } from "../game/rules/racerState";

/**
 * Berechnet den Fortschritt eines Racers als Wert zwischen 0 und 1,
 * basierend auf der zurückgelegten horizontalen Distanz von Spawn bis Ziel.
 */
export function computeMatchProgress(level: LevelDef, racer: RacerRuntimeState): number {
  if (racer.finished) return 1;

  const total = level.goal.x - level.spawn.x;
  if (total <= 0) return 0;

  const travelled = racer.x - level.spawn.x;
  return Math.max(0, Math.min(1, travelled / total));
}
