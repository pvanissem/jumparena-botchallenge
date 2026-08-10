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
    <section>
      <h2>Match-Ergebnis</h2>
      <ol>
        {result.entries.map((entry) => (
          <li key={entry.botId}>
            <strong>{nameById.get(entry.botId) ?? entry.botId}</strong>: Score {entry.score}{" "}
            (Früchte {entry.fruitScore}, Zeit {(entry.timeElapsedMs / 1000).toFixed(1)}s, Tode{" "}
            {entry.deaths}){entry.disabled && " ⏸ pausiert"}
            {!entry.reachedGoal && " – Ziel nicht erreicht"}
          </li>
        ))}
      </ol>
      {winner && (
        <p>
          Sieger: <strong>{nameById.get(winner.botId) ?? winner.botId}</strong>
        </p>
      )}
      {state.status !== "finished" && onContinue && (
        <button type="button" onClick={onContinue}>
          Weiter
        </button>
      )}
    </section>
  );
}
