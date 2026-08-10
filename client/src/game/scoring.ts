/**
 * Scoring-Formel – siehe `.features/level-one-arena/design.md`, Abschnitt
 * "scoring.ts", und `docs/05-scoring-und-heats.md`.
 */

export const SCORING = {
  POINTS_PER_COIN: 10,
  /** Schwelle für den Zeitbonus – eigener Wert, unabhängig von
   *  `RUN_TIME_LIMIT_MS` (90s) aus `rules/racerState.ts`! */
  TIME_BUDGET_MS: 60_000,
  /** Max. zusätzlicher Multiplikator auf die Früchtepunkte bei sofortigem
   *  Finish (0 s verbraucht): Faktor = 1 + diesem Wert, linear fallend auf 1.0
   *  am Ende des Zeitbudgets. */
  TIME_MULTIPLIER_MAX_BONUS: 0.5,
  /** Flat-Zeitbonus (Punkte pro verbleibender ms Budget). Bewusst schwächer
   *  als früher (0.01 -> 0.005), da der Löwenanteil jetzt über den
   *  Multiplikator kommt. */
  TIME_BONUS_FACTOR: 0.005,
  DEATH_PENALTY: 15,
  DNF_PENALTY: 50,
} as const;

export interface ScoreInput {
  fruitScore: number;
  timeElapsedMs: number;
  deaths: number;
  reachedGoal: boolean;
}

/** Anteil des Budgets, der noch übrig ist (0..1, nie negativ). */
function timeBudgetFraction(timeElapsedMs: number): number {
  return Math.max(0, SCORING.TIME_BUDGET_MS - timeElapsedMs) / SCORING.TIME_BUDGET_MS;
}

/**
 * Zeit-Multiplikator auf die Früchtepunkte: `1 + MAX_BONUS` bei 0 s, linear
 * fallend auf `1.0` am Ende des Zeitbudgets, danach konstant `1.0` (kein Malus).
 */
export function computeTimeMultiplier(timeElapsedMs: number): number {
  return 1 + SCORING.TIME_MULTIPLIER_MAX_BONUS * timeBudgetFraction(timeElapsedMs);
}

/**
 * Zusätzlicher Flat-Zeitbonus (additiv, abgeschwächt): je weniger Zeit
 * verbraucht wurde, desto höher – linear bis zum `TIME_BUDGET_MS`-Budget,
 * danach 0 (nie negativ).
 */
export function computeTimeBonus(timeElapsedMs: number): number {
  return Math.max(0, SCORING.TIME_BUDGET_MS - timeElapsedMs) * SCORING.TIME_BONUS_FACTOR;
}

export function computeScore(input: ScoreInput): number {
  if (!input.reachedGoal) {
    return Math.round(
      input.fruitScore - input.deaths * SCORING.DEATH_PENALTY - SCORING.DNF_PENALTY
    );
  }

  const fruitWithMultiplier = input.fruitScore * computeTimeMultiplier(input.timeElapsedMs);
  const flatBonus = computeTimeBonus(input.timeElapsedMs);

  return Math.round(fruitWithMultiplier + flatBonus - input.deaths * SCORING.DEATH_PENALTY);
}
