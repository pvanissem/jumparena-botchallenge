import type {
  InboundMessage,
  MatchProgressMessage,
  TournamentShowAction,
  TournamentShowState,
  TournamentState,
} from "@arena/shared";
import { useEffect } from "react";
import { useBotRegistry } from "../botRegistry/useBotRegistry";
import { AudioControls } from "../components/AudioControls";
import { BotRegistryList } from "../components/BotRegistryList";
import { BotUploadForm } from "../components/BotUploadForm";
import { ChampionView } from "../components/ChampionView";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { MatchResultView } from "../components/MatchResultView";
import { ShowControlPanel } from "../components/ShowControlPanel";
import { TournamentSetup } from "../components/TournamentSetup";
import { LiveScoreboard } from "../components/tournament/LiveScoreboard";
import { TournamentBracket } from "../components/tournament/TournamentBracket";
import { audioSettings } from "../game/audio/audioSettings";
import { buildLiveStandings } from "../tournament/liveStandings";
import { selectActiveMatch } from "../tournament/showSelectors";
import { useMatchProgress } from "../tournament/useMatchProgress";
import { useShowCountdown } from "../tournament/useShowCountdown";
import { useTournamentSession } from "../tournament/useTournamentSession";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

interface AdminTournamentViewProps {
  tournament: TournamentState;
  show: TournamentShowState;
  progressByMatch: Map<string, MatchProgressMessage["entries"]>;
  clockOffsetMs: number;
  send: (message: InboundMessage) => void;
}

export function AdminTournamentView({
  tournament,
  show,
  progressByMatch,
  clockOffsetMs,
  send,
}: AdminTournamentViewProps) {
  const active = selectActiveMatch(tournament, show);
  const remainingSeconds = useShowCountdown(show, clockOffsetMs);
  const standings = active
    ? buildLiveStandings(
        active.match,
        progressByMatch.get(active.match.id) ?? [],
        tournament.livesPerRun
      )
    : [];
  const onControl = (action: TournamentShowAction) =>
    send({ type: "tournament-show-control", action });

  return (
    <section className="admin-tournament-view">
      <ShowControlPanel
        show={show}
        match={active?.match ?? null}
        remainingSeconds={remainingSeconds}
        onControl={onControl}
        onReset={() => send({ type: "tournament-reset" })}
      />

      <div className="admin-tournament-view__workspace">
        <TournamentBracket state={tournament} show={show} variant="admin" />
        <aside className="admin-tournament-view__score">
          {show.phase === "match-running" && active && (
            <LiveScoreboard standings={standings} variant="admin" />
          )}
          {(show.phase === "match-result" || show.phase === "bracket-update") &&
            active?.match.result && (
              <MatchResultView result={active.match.result} state={tournament} />
            )}
          {show.phase === "champion" && <ChampionView state={tournament} />}
        </aside>
      </div>
    </section>
  );
}

export function AdminPage() {
  const { status, send, lastMessage } = useWebSocketConnection("admin");
  const { bots } = useBotRegistry(lastMessage, status);
  const { tournament, show, clockOffsetMs } = useTournamentSession(lastMessage);
  const progressByMatch = useMatchProgress(lastMessage);

  useEffect(
    () =>
      audioSettings.subscribe(() => {
        send({ type: "audio-settings", ...audioSettings.getState() });
      }),
    [send]
  );

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <div>
          <span>Event Operations</span>
          <h1>Coin Quest Control Room</h1>
        </div>
        <ConnectionStatusBadge status={status} />
        <AudioControls />
      </header>

      {!tournament && (
        <div className="admin-preparation">
          <section className="admin-preparation__registry">
            <h2>Bot-Sammelstelle</h2>
            <BotUploadForm send={send} />
            <BotRegistryList bots={bots} onRemove={(id) => send({ type: "bot-remove", id })} />
          </section>
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
        </div>
      )}

      {tournament && show && (
        <AdminTournamentView
          tournament={tournament}
          show={show}
          progressByMatch={progressByMatch}
          clockOffsetMs={clockOffsetMs}
          send={send}
        />
      )}
    </main>
  );
}
