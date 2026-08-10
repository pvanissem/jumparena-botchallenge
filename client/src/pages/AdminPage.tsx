import { useEffect } from "react";
import { useBotRegistry } from "../botRegistry/useBotRegistry";
import { AudioControls } from "../components/AudioControls";
import { BotRegistryList } from "../components/BotRegistryList";
import { BotUploadForm } from "../components/BotUploadForm";
import { BracketView } from "../components/BracketView";
import { ChampionView } from "../components/ChampionView";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { MatchLiveStandings } from "../components/MatchLiveStandings";
import { MatchResultView } from "../components/MatchResultView";
import { TournamentSetup } from "../components/TournamentSetup";
import { audioSettings } from "../game/audio/audioSettings";
import { selectMatchStage } from "../tournament/selectMatchStage";
import { useMatchProgress } from "../tournament/useMatchProgress";
import { useTournamentState } from "../tournament/useTournamentState";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function AdminPage() {
  const { status, send, lastMessage } = useWebSocketConnection();
  const bots = useBotRegistry(lastMessage);
  const tournament = useTournamentState(lastMessage);
  const progressByMatch = useMatchProgress(lastMessage);

  useEffect(
    () =>
      audioSettings.subscribe(() => {
        send({ type: "audio-settings", ...audioSettings.getState() });
      }),
    [send]
  );

  const stage = selectMatchStage(tournament);

  return (
    <main>
      <h1>Admin</h1>
      <ConnectionStatusBadge status={status} />
      <AudioControls />

      <section>
        <h2>Bot-Sammelstelle</h2>
        <BotUploadForm send={send} />
        <BotRegistryList bots={bots} onRemove={(id) => send({ type: "bot-remove", id })} />
      </section>

      {!tournament && (
        <TournamentSetup
          bots={bots}
          onStart={(stageLevelIds, botIds, livesPerRun, groupSize) =>
            send({
              type: "tournament-configure",
              mode: "single-elimination",
              stageLevelIds,
              botIds,
              livesPerRun,
              groupSize,
            })
          }
        />
      )}

      {tournament && stage.kind === "champion" && (
        <ChampionView state={tournament} onReset={() => send({ type: "tournament-reset" })} />
      )}

      {tournament && stage.kind !== "champion" && (
        <>
          {/* Der Bracket bleibt immer sichtbar: Von hier aus wird jedes noch
              ausstehende Match gestartet – auch das der nächsten Runde. */}
          <BracketView
            state={tournament}
            onStartMatch={(matchId) => send({ type: "match-start", matchId })}
          />

          {stage.kind === "running" && (
            <MatchLiveStandings
              entries={progressByMatch.get(stage.match.id) ?? []}
              nameById={new Map(stage.match.participants.map((p) => [p.botId, p.name]))}
            />
          )}

          {stage.kind === "result" && stage.match.result && (
            <MatchResultView result={stage.match.result} state={tournament} />
          )}

          <button type="button" onClick={() => send({ type: "tournament-reset" })}>
            Turnier zurücksetzen
          </button>
        </>
      )}
    </main>
  );
}
