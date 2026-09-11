/**
 * Bestenliste des `/play`-Modus – siehe `.features/play-mode/design.md`,
 * Abschnitt "Highscore" (US-6). Pur; die Persistenz liegt in
 * `highscoreStore.ts`.
 */

export interface HighscoreEntry {
  id: string;
  name: string;
  score: number;
  levelsCompleted: number;
  /** Zeitstempel des Runs (ms). Entscheidet Gleichstände: älter gewinnt. */
  createdAt: number;
}

/** So viele Einträge zeigt die Anzeige – zugleich die Grenze für "Platzierung". */
export const HIGHSCORE_DISPLAY_SIZE = 10;

export function sortHighscores(entries: readonly HighscoreEntry[]): HighscoreEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
}

export interface HighscoreInsertResult {
  entries: HighscoreEntry[];
  /** 1-basierte Platzierung, oder `null` außerhalb der Top 10. */
  rank: number | null;
}

export function insertHighscore(
  entries: readonly HighscoreEntry[],
  entry: HighscoreEntry
): HighscoreInsertResult {
  const sorted = sortHighscores([...entries, entry]);
  const position = sorted.findIndex((candidate) => candidate.id === entry.id);
  const rank = position >= 0 && position < HIGHSCORE_DISPLAY_SIZE ? position + 1 : null;
  return { entries: sorted, rank };
}
