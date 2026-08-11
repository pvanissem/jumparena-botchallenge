import type { TournamentState } from "@arena/shared";

interface ChampionViewProps {
  state: TournamentState;
  onReset?: () => void;
}

export function ChampionView({ state, onReset }: ChampionViewProps) {
  const champion = state.rounds
    .flat()
    .flatMap((m) => m.participants)
    .find((p) => p.botId === state.championBotId);

  return (
    <section className="champion-view">
      <span className="champion-view__crown" aria-hidden="true">
        ♛
      </span>
      <h2>Champion der Arena</h2>
      {champion ? (
        <>
          <p className="champion-view__name">
            <strong>{champion.name}</strong>
          </p>
          <p>gebaut von {champion.author}</p>
          <p>Herzlichen Glückwunsch!</p>
        </>
      ) : (
        <p>Unbekannter Champion.</p>
      )}
      {onReset && (
        <button type="button" onClick={onReset}>
          Turnier zurücksetzen
        </button>
      )}
    </section>
  );
}
