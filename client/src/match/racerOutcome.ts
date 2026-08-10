import type { RacerRuntimeState } from "../game/rules/racerState";
import type { BotRunnerPauseReasonKind } from "../sandbox/BotRunner";

export type RacerOutcomeKind = "goal" | "out-of-lives" | "time-limit" | "disabled";

export interface RacerOutcome {
  kind: RacerOutcomeKind;
  /** `true` nur bei `kind === "goal"`. */
  reachedGoal: boolean;
}

/**
 * Klassifiziert den Endzustand eines Racers. Liefert `null`, solange der Racer
 * noch läuft.
 *
 * Reihenfolge der Ableitungsregeln (jede Regel bricht ab):
 * 1. `racer.finished` → "goal" (Ziel schlägt alles).
 * 2. `pausedReasonKind !== null` → "disabled" (Bot pausiert).
 * 3. `racer.didNotFinish && racer.livesRemaining <= 0` → "out-of-lives".
 * 4. `racer.didNotFinish` → "time-limit".
 * 5. sonst → `null`.
 */
export function deriveRacerOutcome(
  racer: RacerRuntimeState,
  pausedReasonKind: BotRunnerPauseReasonKind | null
): RacerOutcome | null {
  if (racer.finished) {
    return { kind: "goal", reachedGoal: true };
  }

  if (pausedReasonKind !== null) {
    return { kind: "disabled", reachedGoal: false };
  }

  if (racer.didNotFinish) {
    if (racer.livesRemaining <= 0) {
      return { kind: "out-of-lives", reachedGoal: false };
    }
    return { kind: "time-limit", reachedGoal: false };
  }

  return null;
}
