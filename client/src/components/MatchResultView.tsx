import type { MatchResult, TournamentState } from "@arena/shared";

interface MatchResultViewProps {
  result: MatchResult;
  state: TournamentState;
  onContinue?: () => void;
}

export function MatchResultView({ result, state, onContinue }: MatchResultViewProps) {
  const nameById = new Map(
    state.rounds
      .flat()
      .flatMap((match) => match.participants.map((p) => [p.botId, p.name] as const))
  );
  const winner = result.entries.find((entry) => entry.rank === 1);

  return (
    <section className="match-result-view">
      <header className="match-result-view__header">
        <span className="match-result-view__eyebrow">Match complete</span>
        <h2>
          {winner ? `${nameById.get(winner.botId) ?? winner.botId} gewinnt!` : "Match beendet"}
        </h2>
      </header>
      <ol className="match-result-view__scores">
        {result.entries.map((entry) => (
          <li key={entry.botId} data-winner={entry.rank === 1 ? "true" : "false"}>
            <span className="match-result-view__rank">#{entry.rank}</span>
            <strong>{nameById.get(entry.botId) ?? entry.botId}</strong>
            <strong className="match-result-view__points">{entry.score} PTS</strong>
            <span>{entry.fruitScore} Früchte</span>
            <span>{(entry.timeElapsedMs / 1000).toFixed(1)}s</span>
            <span>{entry.deaths} Tode</span>
            {entry.disabled && <span>Deaktiviert</span>}
            {!entry.reachedGoal && <span>Ziel nicht erreicht</span>}
          </li>
        ))}
      </ol>
      {state.status !== "finished" && onContinue && (
        <button className="match-result-view__continue" type="button" onClick={onContinue}>
          Weiter
        </button>
      )}
    </section>
  );
}
