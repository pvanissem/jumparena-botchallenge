export type TournamentMode = "single-elimination";

/** Leben pro Racer und Match, wenn nichts anderes konfiguriert wurde. */
export const DEFAULT_LIVES_PER_RUN = 3;
export const MIN_LIVES_PER_RUN = 1;
export const MAX_LIVES_PER_RUN = 99;

/**
 * Einzige Quelle der Wahrheit für die Leben-Validierung: ganzzahlig und
 * innerhalb [MIN, MAX]. Wird von `/admin` (Hinweis vor dem Senden) und vom
 * Server (Ablehnung) genutzt, damit beide Seiten nicht auseinanderdriften.
 */
export function isValidLivesPerRun(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_LIVES_PER_RUN &&
    value <= MAX_LIVES_PER_RUN
  );
}

export interface MatchParticipant {
  botId: string;
  name: string;
  author: string;
  color: string;
}

export type MatchStatus = "pending" | "running" | "finished";

export interface MatchDef {
  id: string;
  participants: MatchParticipant[];
  status: MatchStatus;
  /** Erst nach Abschluss gesetzt (bzw. sofort bei Freilos). */
  result: MatchResult | null;
}

export interface MatchResultEntry {
  botId: string;
  rank: number;
  score: number;
  fruitScore: number;
  coinsCollected: number;
  deaths: number;
  timeElapsedMs: number;
  reachedGoal: boolean;
  /** Bot wurde wegen Fehlern/Timeouts pausiert. */
  disabled: boolean;
}

/** Ergebnis EINES Matches; aufsteigend nach `rank` sortiert. */
export interface MatchResult {
  entries: MatchResultEntry[];
}

export interface TournamentState {
  mode: TournamentMode;
  levelId: string;
  /** Leben pro Racer in jedem Match dieses Turniers (siehe
   *  `.features/tournament-lives/`). */
  livesPerRun: number;
  /** Runden -> Matches. `rounds[0]` = erste Runde. */
  rounds: MatchDef[][];
  status: "idle" | "running" | "finished";
  championBotId: string | null;
}
