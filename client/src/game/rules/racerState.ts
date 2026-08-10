/**
 * Racer-Laufzeitzustand – siehe `.features/level-one-arena/design.md`,
 * Abschnitt "rules/racerState.ts". Rein, kein Phaser-Import.
 */
import { DEFAULT_LIVES_PER_RUN } from "@arena/shared";
import type { LevelDef } from "../level/types";

/** Leben pro Lauf (Default). Der Wert lebt in `@arena/shared`, weil ihn auch
 *  Server-Validierung und `/admin`-UI brauchen – siehe
 *  `.features/tournament-lives/design.md`. Im Turnier kann er pro Turnier
 *  überschrieben werden (`TournamentState.livesPerRun`). */
export const LIVES_PER_RUN = DEFAULT_LIVES_PER_RUN;
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
  /** Zeitpunkt (elapsedMs), zu dem ein Trigger-Hazard (z.B. Spikehead) zuletzt
   *  ausgelöst wurde, je Hazard-ID. Fehlt ein Eintrag -> nie ausgelöst / der
   *  vorige Zyklus ist bereits abgeklungen und der Hazard wieder scharf. */
  hazardTriggeredAtMs: ReadonlyMap<string, number>;
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
    hazardTriggeredAtMs: new Map<string, number>(),
  };
}

/**
 * Endzustand erreicht: Ziel erreicht ODER ausgeschieden (keine Leben mehr bzw.
 * Zeitlimit). Als pure Funktion herausgezogen, damit die Stopp-Bedingung der
 * Szene testbar ist, ohne Phaser zu starten (siehe
 * `.features/tournament-lives/`, US-2).
 */
export function isRacerTerminal(state: RacerRuntimeState): boolean {
  return state.finished || state.didNotFinish;
}
