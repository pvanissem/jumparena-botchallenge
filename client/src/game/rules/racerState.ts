/**
 * Racer-Laufzeitzustand – siehe `.features/level-one-arena/design.md`,
 * Abschnitt "rules/racerState.ts". Rein, kein Phaser-Import.
 */
import type { LevelDef } from "../level/types";

/** Leben pro Lauf (docs/05-Vorschlagswert). */
export const LIVES_PER_RUN = 3;
/** Zeitlimit pro Lauf, ab dem ein noch nicht fertiger Racer als DNF gilt (docs/05, "Zeitlimit pro Heat"). */
export const RUN_TIME_LIMIT_MS = 90_000;

export interface RacerRuntimeState {
  x: number;
  y: number;
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;
  finished: boolean;
  didNotFinish: boolean;
  coinsCollected: number;
  fruitScore: number;
  livesRemaining: number;
  deaths: number;
  timeElapsedMs: number;
  /** Position des zuletzt erreichten Checkpoints (Respawn-Ziel). */
  lastCheckpoint: { x: number; y: number };
  /** IDs bereits eingesammelter Münzen (inkl. aus aufgelösten Blöcken entstandener). */
  collectedCoinIds: ReadonlySet<string>;
  /** IDs bereits ausgelöster versteckter Blöcke. */
  resolvedBlockIds: ReadonlySet<string>;
}

export function createInitialRacerState(
  level: LevelDef,
  startingLives: number = LIVES_PER_RUN
): RacerRuntimeState {
  return {
    x: level.spawn.x,
    y: level.spawn.y,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: false,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 0,
    livesRemaining: startingLives,
    deaths: 0,
    timeElapsedMs: 0,
    lastCheckpoint: { x: level.spawn.x, y: level.spawn.y },
    collectedCoinIds: new Set<string>(),
    resolvedBlockIds: new Set<string>(),
  };
}
