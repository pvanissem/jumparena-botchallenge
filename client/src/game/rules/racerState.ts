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
  lastCheckpointId: string | null;
  reachedCheckpointIds: ReadonlySet<string>;
  /** IDs bereits eingesammelter Münzen (inkl. aus aufgelösten Blöcken entstandener). */
  collectedCoinIds: ReadonlySet<string>;
  /** IDs bereits ausgelöster versteckter Blöcke. */
  resolvedBlockIds: ReadonlySet<string>;
  /** IDs bereits gestompter Hazards (z. B. ninjafrog) – siehe
   *  `.features/hazard-destroyed-state-in-bot-vision/bugfix.md`. */
  destroyedHazardIds: ReadonlySet<string>;
  /** Zeitpunkt (elapsedMs), zu dem ein Trigger-Hazard (z.B. Spikehead) zuletzt
   *  ausgelöst wurde, je Hazard-ID. Fehlt ein Eintrag -> nie ausgelöst / der
   *  vorige Zyklus ist bereits abgeklungen und der Hazard wieder scharf. */
  hazardTriggeredAtMs: ReadonlyMap<string, number>;
}

export function createInitialRacerState(
  level: LevelDef,
  startingLives: number = LIVES_PER_RUN,
  startCheckpointId?: string
): RacerRuntimeState {
  const checkpoint = level.checkpoints.find((entry) => entry.id === startCheckpointId);
  return {
    x: checkpoint?.x ?? level.spawn.x,
    y: checkpoint ? checkpoint.y - 80 : level.spawn.y,
    facing: "right",
    onGround: false,
    isAlive: true,
    finished: false,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 0,
    livesRemaining: startingLives,
    deaths: 0,
    timeElapsedMs: 0,
    lastCheckpoint: checkpoint
      ? { x: checkpoint.x, y: checkpoint.y }
      : { x: level.spawn.x, y: level.spawn.y },
    lastCheckpointId: checkpoint?.id ?? null,
    reachedCheckpointIds: new Set(checkpoint ? [checkpoint.id] : []),
    collectedCoinIds: new Set<string>(),
    resolvedBlockIds: new Set<string>(),
    destroyedHazardIds: new Set<string>(),
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
