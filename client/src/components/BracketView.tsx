import type { TournamentState } from "@arena/shared";

interface BracketViewProps {
  state: TournamentState;
  onStartMatch?: (matchId: string) => void;
}

export function BracketView({ state, onStartMatch }: BracketViewProps) {
  return (
    <section>
      <h2>Turnierbaum</h2>
      {state.rounds.map((round, roundIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Runden werden nur angehängt, Index ist stabil.
        <div key={`round-${roundIndex}-${round.map((m) => m.id).join("-")}`}>
          <h3>Runde {roundIndex + 1}</h3>
          <ul>
            {round.map((match) => {
              const names = match.participants.map((p) => p.name).join(", ");
              const winnerId = match.result?.entries.find((e) => e.rank === 1)?.botId;
              const winner = match.participants.find((p) => p.botId === winnerId);

              if (match.status === "finished") {
                return (
                  <li key={match.id}>
                    {names} — {match.participants.length === 1 ? "Freilos" : "Sieger"}:{" "}
                    <strong>{winner?.name ?? "-"}</strong>
                  </li>
                );
              }

              if (match.status === "running") {
                return <li key={match.id}>{names} — läuft…</li>;
              }

              return (
                <li key={match.id}>
                  {names}{" "}
                  {onStartMatch && (
                    <button type="button" onClick={() => onStartMatch(match.id)}>
                      Starten
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
