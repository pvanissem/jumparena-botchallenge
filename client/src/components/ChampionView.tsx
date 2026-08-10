import type { TournamentState } from "@arena/shared";

interface ChampionViewProps {
  state: TournamentState;
  onReset: () => void;
}

export function ChampionView({ state, onReset }: ChampionViewProps) {
  const champion = state.rounds
    .flat()
    .flatMap((m) => m.participants)
    .find((p) => p.botId === state.championBotId);

  return (
    <section>
      <h2>Champion</h2>
      {champion ? (
        <>
          <p>
            <strong>{champion.name}</strong> von {champion.author}
          </p>
          <p>Herzlichen Glückwunsch!</p>
        </>
      ) : (
        <p>Unbekannter Champion.</p>
      )}
      <button type="button" onClick={onReset}>
        Turnier zurücksetzen
      </button>
    </section>
  );
}
