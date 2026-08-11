import type {
  BotArtifact,
  MatchProgressMessage,
  MatchResult,
  TournamentShowState,
  TournamentState,
} from "@arena/shared";
import { resolveStageLevelId } from "@arena/shared";
import { useCallback, useEffect, useMemo } from "react";
import { useBotRegistry } from "../botRegistry/useBotRegistry";
import { ChampionView } from "../components/ChampionView";
import { MatchResultView } from "../components/MatchResultView";
import { RosterAttractView } from "../components/RosterAttractView";
import { EventChrome } from "../components/tournament/EventChrome";
import { LiveScoreboard } from "../components/tournament/LiveScoreboard";
import { MatchupStage } from "../components/tournament/MatchupStage";
import { TournamentBracket } from "../components/tournament/TournamentBracket";
import { audioSettings } from "../game/audio/audioSettings";
import { useShowAudioCue } from "../game/audio/useShowAudioCue";
import { MatchView } from "../match/MatchView";
import { buildLiveStandings } from "../tournament/liveStandings";
import { selectActiveMatch } from "../tournament/showSelectors";
import { useMatchProgress } from "../tournament/useMatchProgress";
import { useShowCountdown } from "../tournament/useShowCountdown";
import { useTournamentSession } from "../tournament/useTournamentSession";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

interface PresentStageProps {
  tournament: TournamentState | null;
  show: TournamentShowState | null;
  clientId: string | null;
  bots: BotArtifact[];
  progressByMatch: Map<string, MatchProgressMessage["entries"]>;
  clockOffsetMs: number;
  onProgress: (entries: MatchProgressMessage["entries"]) => void;
  onFinished: (result: MatchResult) => void;
}

function roundLabel(roundIndex: number): string {
  return `Runde ${roundIndex + 1}`;
}

export function PresentStage({
  tournament,
  show,
  clientId,
  bots,
  progressByMatch,
  clockOffsetMs,
  onProgress,
  onFinished,
}: PresentStageProps) {
  const countdown = useShowCountdown(show, clockOffsetMs);
  const active = selectActiveMatch(tournament, show);
  const sourceById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot.sourceCode])), [bots]);
  const standings = useMemo(() => {
    if (!tournament || !active) return [];
    return buildLiveStandings(
      active.match,
      progressByMatch.get(active.match.id) ?? [],
      tournament.livesPerRun
    );
  }, [active, progressByMatch, tournament]);

  if (!tournament) return <RosterAttractView bots={bots} />;
  if (!show) return <TournamentBracket state={tournament} show={null} variant="present" />;

  switch (show.phase) {
    case "ready":
    case "bracket-update":
      return <TournamentBracket state={tournament} show={show} variant="present" />;
    case "matchup-intro":
    case "countdown":
      return active ? (
        <MatchupStage
          match={active.match}
          roundLabel={roundLabel(active.roundIndex)}
          countdown={show.phase === "countdown" ? countdown : null}
        />
      ) : (
        <TournamentBracket state={tournament} show={show} variant="present" />
      );
    case "match-running": {
      if (!active) return <TournamentBracket state={tournament} show={show} variant="present" />;
      const isExecutor = clientId !== null && clientId === show.executorClientId;
      return (
        <section className="present-live-stage">
          <LiveScoreboard standings={standings} variant="present" />
          {isExecutor && show.matchAttemptId ? (
            <MatchView
              key={`${active.match.id}:${show.matchAttemptId}`}
              match={active.match}
              levelId={resolveStageLevelId(tournament.stageLevelIds, active.roundIndex)}
              livesPerRun={tournament.livesPerRun}
              sourceById={sourceById}
              onProgress={onProgress}
              onFinished={onFinished}
              className="present-live-stage__game"
            />
          ) : (
            <p className="present-live-stage__display-note">
              Display-Modus – die Match-Engine läuft auf der zugewiesenen Present-Instanz.
            </p>
          )}
        </section>
      );
    }
    case "match-result":
      return active?.match.result ? (
        <MatchResultView result={active.match.result} state={tournament} />
      ) : (
        <TournamentBracket state={tournament} show={show} variant="present" />
      );
    case "champion":
      return <ChampionView state={tournament} />;
  }
}

export function PresentPage() {
  const { status, send, lastMessage, clientId } = useWebSocketConnection("present");
  const { bots, initialized } = useBotRegistry(lastMessage, status);
  const { tournament, show, clockOffsetMs } = useTournamentSession(lastMessage);
  const progressByMatch = useMatchProgress(lastMessage);
  const active = selectActiveMatch(tournament, show);

  useShowAudioCue(show);

  useEffect(() => {
    if (lastMessage?.type !== "audio-settings") return;
    audioSettings.setMuted(lastMessage.muted);
    audioSettings.setVolume(lastMessage.volume);
  }, [lastMessage]);

  useEffect(() => {
    if (status === "connected" && initialized) {
      send({ type: "present-ready", ready: true });
    }
  }, [initialized, send, status]);

  const handleProgress = useCallback(
    (entries: MatchProgressMessage["entries"]) => {
      if (!active || !show?.matchAttemptId) return;
      send({
        type: "match-progress",
        matchId: active.match.id,
        matchAttemptId: show.matchAttemptId,
        entries,
      });
    },
    [active, send, show?.matchAttemptId]
  );

  const handleFinished = useCallback(
    (result: MatchResult) => {
      if (!active || !show?.matchAttemptId) return;
      send({
        type: "match-result",
        matchId: active.match.id,
        matchAttemptId: show.matchAttemptId,
        result,
      });
    },
    [active, send, show?.matchAttemptId]
  );

  return (
    <EventChrome show={show} connectionStatus={status}>
      <PresentStage
        tournament={tournament}
        show={show}
        clientId={clientId}
        bots={bots}
        progressByMatch={progressByMatch}
        clockOffsetMs={clockOffsetMs}
        onProgress={handleProgress}
        onFinished={handleFinished}
      />
    </EventChrome>
  );
}
