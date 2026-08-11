import type { MatchResultEntry } from "@arena/shared";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { computeScore } from "../game/scoring";

export interface RankableRacer {
  botId: string;
  state: RacerRuntimeState;
  disabled: boolean;
}

/**
 * Wandelt die Laufzeit-Zustände der Racer in eine sortierte Match-Ergebnis-
 * Liste um. Sortierung: Score absteigend, bei Gleichstand kürzere Zeit.
 */
export function rankMatchResults(racers: readonly RankableRacer[]): MatchResultEntry[] {
  const scored = racers.map(({ botId, state, disabled }): MatchResultEntry => {
    const timeElapsedMs = Math.round(state.timeElapsedMs);
    const score = computeScore({
      fruitScore: state.fruitScore,
      timeElapsedMs,
      deaths: state.deaths,
      reachedGoal: state.finished,
    });

    return {
      botId,
      rank: 0,
      score,
      fruitScore: state.fruitScore,
      coinsCollected: state.coinsCollected,
      deaths: state.deaths,
      timeElapsedMs,
      reachedGoal: state.finished,
      disabled,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeElapsedMs - b.timeElapsedMs;
  });

  for (let i = 0; i < scored.length; i++) {
    scored[i] = { ...scored[i], rank: i + 1 };
  }

  return scored;
}
