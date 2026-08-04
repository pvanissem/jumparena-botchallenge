/**
 * Scoring-Formel – siehe `.features/level-one-arena/design.md`, Abschnitt
 * "scoring.ts", und `docs/05-scoring-und-heats.md`.
 */

export const SCORING = {
  POINTS_PER_COIN: 10,
  /** Schwelle für den Zeitbonus – eigener Wert, unabhängig von
   *  `RUN_TIME_LIMIT_MS` (90s) aus `rules/racerState.ts`! */
  TIME_BUDGET_MS: 60_000,
  TIME_BONUS_FACTOR: 0.01,
  DEATH_PENALTY: 15,
  DNF_PENALTY: 50,
} as const;

export interface ScoreInput {
  fruitScore: number;
  timeElapsedMs: number;
  deaths: number;
  reachedGoal: boolean;
}

export function computeScore(input: ScoreInput): number {
  const timeBonus = input.reachedGoal
    ? Math.max(0, SCORING.TIME_BUDGET_MS - input.timeElapsedMs) * SCORING.TIME_BONUS_FACTOR
    : 0;
  const dnfPenalty = input.reachedGoal ? 0 : SCORING.DNF_PENALTY;

  return Math.round(
    input.fruitScore + timeBonus - input.deaths * SCORING.DEATH_PENALTY - dnfPenalty
  );
}
