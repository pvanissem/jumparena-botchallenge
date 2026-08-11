import type {
  MatchDef,
  MatchParticipant,
  MatchResult,
  TournamentMode,
  TournamentState,
} from "@arena/shared";

/** Optionen für die Bracket-Erzeugung. Objekt statt vieler Positions-Parameter,
 *  damit weitere Turnier-Einstellungen ergänzt werden können, ohne jede
 *  Signatur anzufassen. */
export interface CreateRoundsOptions {
  /** Bots pro Match (siehe `@arena/shared#ALLOWED_GROUP_SIZES`). */
  groupSize: number;
}

/**
 * Abstrakte Turnier-Strategie. Neue Modi werden durch eine neue Implementierung
 * ergänzt, ohne bestehende zu verändern (Open/Closed Principle).
 */
export interface TournamentStrategy {
  readonly mode: TournamentMode;

  createRounds(participants: MatchParticipant[], options: CreateRoundsOptions): MatchDef[][];

  /** Baut den Zustand nach einem Match-Ergebnis fort (neue Runde, Champion, …). */
  advance(state: TournamentState, matchId: string, result: MatchResult): TournamentState;
}
