import type { MatchProgressMessage, MatchResult } from "@arena/shared";
import { useCallback, useEffect, useMemo } from "react";
import { useBotRegistry } from "../botRegistry/useBotRegistry";
import { BotRegistryList } from "../components/BotRegistryList";
import { BracketView } from "../components/BracketView";
import { BroadcastFeed } from "../components/BroadcastFeed";
import { ChampionView } from "../components/ChampionView";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { MatchResultView } from "../components/MatchResultView";
import { audioSettings } from "../game/audio/audioSettings";
import { MatchView } from "../match/MatchView";
import { selectMatchStage } from "../tournament/selectMatchStage";
import { useTournamentState } from "../tournament/useTournamentState";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function PresentPage() {
  const { status, send, lastMessage } = useWebSocketConnection();
  const bots = useBotRegistry(lastMessage);
  const tournament = useTournamentState(lastMessage);

  useEffect(() => {
    if (lastMessage?.type !== "audio-settings") return;
    audioSettings.setMuted(lastMessage.muted);
    audioSettings.setVolume(lastMessage.volume);
  }, [lastMessage]);

  const sourceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const bot of bots) map.set(bot.id, bot.sourceCode);
    return map;
  }, [bots]);

  const stage = selectMatchStage(tournament);
  const runningMatchId = stage.kind === "running" ? stage.match.id : null;

  const handleProgress = useCallback(
    (entries: MatchProgressMessage["entries"]) => {
      if (!runningMatchId) return;
      send({ type: "match-progress", matchId: runningMatchId, entries });
    },
    [runningMatchId, send]
  );

  const handleFinished = useCallback(
    (result: MatchResult) => {
      if (!runningMatchId) return;
      send({ type: "match-result", matchId: runningMatchId, result });
    },
    [runningMatchId, send]
  );

  return (
    <main>
      <h1>Präsentation</h1>
      <ConnectionStatusBadge status={status} />
      <BroadcastFeed lastMessage={lastMessage} />

      {stage.kind === "no-tournament" && (
        <section>
          <h2>Eingereichte Bots</h2>
          <BotRegistryList bots={bots} />
        </section>
      )}

      {stage.kind === "champion" && tournament && (
        <ChampionView state={tournament} onReset={() => send({ type: "tournament-reset" })} />
      )}

      {stage.kind === "running" && tournament && (
        <MatchView
          key={stage.match.id}
          match={stage.match}
          levelId={tournament.levelId}
          livesPerRun={tournament.livesPerRun}
          sourceById={sourceById}
          onProgress={handleProgress}
          onFinished={handleFinished}
        />
      )}

      {stage.kind === "result" && tournament && stage.match.result && (
        <>
          <MatchResultView result={stage.match.result} state={tournament} />
          <BracketView state={tournament} />
        </>
      )}

      {stage.kind === "bracket" && tournament && <BracketView state={tournament} />}
    </main>
  );
}
