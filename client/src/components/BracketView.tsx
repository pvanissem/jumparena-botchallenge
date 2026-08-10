import type { TournamentState } from "@arena/shared";
import { resolveStageLevelId } from "@arena/shared";
import { LEVEL_REGISTRY } from "../game/level/levelRegistry";
import { computeRoundStatus, type RoundStatus } from "../tournament/roundStatus";

interface BracketViewProps {
  state: TournamentState;
  onStartMatch?: (matchId: string) => void;
}

function levelLabel(levelId: string): string {
  return LEVEL_REGISTRY.find((entry) => entry.id === levelId)?.label ?? levelId;
}

function statusLabel(status: RoundStatus): string {
  switch (status) {
    case "running":
      return "läuft";
    case "finished":
      return "abgeschlossen";
    case "pending":
      return "ausstehend";
  }
}

export function BracketView({ state, onStartMatch }: BracketViewProps) {
  return (
    <section>
      <h2>Turnierbaum</h2>
      {state.rounds.map((round, roundIndex) => {
        const levelId = resolveStageLevelId(state.stageLevelIds, roundIndex);
        const status = computeRoundStatus(round);

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: Runden werden nur angehängt, Index ist stabil.
          <div key={`round-${roundIndex}-${round.map((m) => m.id).join("-")}`}>
            <h3>
              Runde {roundIndex + 1} — {levelLabel(levelId)} ({statusLabel(status)})
            </h3>
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
        );
      })}
    </section>
  );
}
