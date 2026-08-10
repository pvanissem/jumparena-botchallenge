import type {
  MatchDef,
  MatchParticipant,
  MatchResult,
  TournamentMode,
  TournamentState,
} from "@arena/shared";

/**
 * Abstrakte Turnier-Strategie. Neue Modi werden durch eine neue Implementierung
 * ergänzt, ohne bestehende zu verändern (Open/Closed Principle).
 */
export interface TournamentStrategy {
  readonly mode: TournamentMode;

  createRounds(participants: MatchParticipant[], levelId: string): MatchDef[][];

  /** Baut den Zustand nach einem Match-Ergebnis fort (neue Runde, Champion, …). */
  advance(state: TournamentState, result: MatchResult): TournamentState;
}
