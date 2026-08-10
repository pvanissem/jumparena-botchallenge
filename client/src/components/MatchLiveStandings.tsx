import type { MatchProgressMessage } from "@arena/shared";

interface MatchLiveStandingsProps {
  entries: MatchProgressMessage["entries"];
  /** Optional: Anzeigenamen je Bot-ID. Fehlt ein Eintrag, wird die ID gezeigt. */
  nameById?: ReadonlyMap<string, string>;
}

export function MatchLiveStandings({ entries, nameById }: MatchLiveStandingsProps) {
  const sorted = [...entries].sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress;
    return a.timeElapsedMs - b.timeElapsedMs;
  });

  return (
    <section>
      <h3>Live-Rangliste</h3>
      {sorted.length === 0 ? (
        <p>Noch keine Live-Daten.</p>
      ) : (
        <ol>
          {sorted.map((entry) => (
            <li key={entry.botId}>
              <strong>{nameById?.get(entry.botId) ?? entry.botId}</strong>: {entry.fruitScore}{" "}
              Punkte, {Math.round(entry.progress * 100)}% Fortschritt,{" "}
              {(entry.timeElapsedMs / 1000).toFixed(1)}s, {entry.livesRemaining} Leben
              {entry.finished && " ✅"}
              {entry.didNotFinish && " ❌"}
              {entry.disabled && " ⏸"}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
