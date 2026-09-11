/**
 * Bestenliste des `/play`-Modus – siehe `.features/play-mode/design.md`,
 * Abschnitt "Seite & UI" (US-6). Reine Darstellung; Sortierung und Grenze
 * kommen aus `highscore.ts`.
 */
import { HIGHSCORE_DISPLAY_SIZE, type HighscoreEntry, sortHighscores } from "./highscore";

interface HighscorePanelProps {
  entries: readonly HighscoreEntry[];
  /** Zuletzt eingetragenes Ergebnis – wird hervorgehoben. */
  highlightId: string | null;
}

export function HighscorePanel({ entries, highlightId }: HighscorePanelProps) {
  const visible = sortHighscores(entries).slice(0, HIGHSCORE_DISPLAY_SIZE);

  return (
    <section className="play-highscores">
      <h2 className="play-highscores__title">🏆 Bestenliste</h2>
      {visible.length === 0 ? (
        <p className="play-highscores__empty">Noch keine Ergebnisse – sei die/der Erste!</p>
      ) : (
        <ol className="play-highscores__list">
          {visible.map((entry, index) => (
            <li
              key={entry.id}
              data-testid={`highscore-row-${index}`}
              data-highlight={entry.id === highlightId ? "true" : "false"}
              className={`play-highscores__row${entry.id === highlightId ? " is-highlight" : ""}`}
            >
              <span className="play-highscores__rank">{index + 1}</span>
              <span className="play-highscores__name">{entry.name}</span>
              <span className="play-highscores__levels">{entry.levelsCompleted} Level</span>
              <span className="play-highscores__score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
