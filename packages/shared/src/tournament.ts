export type TournamentMode = "single-elimination";

/** Bots, die gleichzeitig in einem Match gegeneinander antreten. */
export const DEFAULT_GROUP_SIZE = 4;

/** Bewusst nur diese beiden Werte – siehe requirements.md, Nicht-Ziele:
 *  Für andere Größen existiert weder ein Grid-Layout in
 *  `computeGridViewports` noch eine Performance-Aussage
 *  (docs/07-offene-punkte.md). */
export const ALLOWED_GROUP_SIZES = [2, 4] as const;

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
  /** Level je Runde. `stageLevelIds[0]` = Runde 1. Enthält mindestens einen
   *  Eintrag. Runden jenseits der Liste nutzen den letzten Eintrag
   *  (siehe `resolveStageLevelId`). */
  stageLevelIds: string[];
  /** Leben pro Racer in jedem Match dieses Turniers (siehe
   *  `.features/tournament-lives/`). */
  livesPerRun: number;
  /** Bots pro Match in allen Runden dieses Turniers. */
  groupSize: number;
  /** Runden -> Matches. `rounds[0]` = erste Runde. */
  rounds: MatchDef[][];
  status: "idle" | "running" | "finished";
  championBotId: string | null;
}

/** Level der Runde `roundIndex` (0-basiert). Runden ohne eigene Stage nutzen
 *  die zuletzt konfigurierte Stage (US-3). */
export function resolveStageLevelId(stageLevelIds: readonly string[], roundIndex: number): string {
  if (stageLevelIds.length === 0) {
    throw new Error("stageLevelIds darf nicht leer sein");
  }
  return stageLevelIds[Math.min(roundIndex, stageLevelIds.length - 1)];
}

/** Erwartete Rundenzahl eines Single-Elimination-Turniers (US-5). */
export function estimateRoundCount(participantCount: number, groupSize: number): number {
  if (participantCount <= 1) return 0;
  let rounds = 0;
  let remaining = participantCount;
  while (remaining > 1) {
    rounds += 1;
    remaining = Math.ceil(remaining / groupSize);
  }
  return rounds;
}

/**
 * Einzige Quelle der Wahrheit für die Gruppengrößen-Validierung: ganzzahlig
 * und einer der erlaubten Werte. Wird von `/admin` (Vorauswahl/Validierung)
 * und vom Server (Ablehnung) genutzt.
 */
export function isValidGroupSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (ALLOWED_GROUP_SIZES as readonly number[]).includes(value)
  );
}
