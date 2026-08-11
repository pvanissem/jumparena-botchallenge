import type { MatchDef, MatchProgressMessage, MatchResult, TournamentState } from "@arena/shared";
import { resolveStageLevelId } from "@arena/shared";
import { useCallback, useEffect, useMemo } from "react";
import { useBotRegistry } from "../botRegistry/useBotRegistry";
import { BotRegistryList } from "../components/BotRegistryList";
import { BracketView } from "../components/BracketView";
import { ChampionView } from "../components/ChampionView";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { MatchResultView } from "../components/MatchResultView";
import { audioSettings } from "../game/audio/audioSettings";
import { LEVEL_REGISTRY } from "../game/level/levelRegistry";
import { RUN_TIME_LIMIT_MS } from "../game/rules/racerState";
import { computeScore, computeTimeBonus, computeTimeMultiplier } from "../game/scoring";
import { MatchView } from "../match/MatchView";
import { selectMatchStage } from "../tournament/selectMatchStage";
import { useMatchProgress } from "../tournament/useMatchProgress";
import { useTournamentSession } from "../tournament/useTournamentSession";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

function formatScoreHudValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "∞";
}

function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function PresentHudBar({
  tournament,
  progressByMatch,
  match,
}: {
  tournament: TournamentState;
  progressByMatch: Map<string, MatchProgressMessage["entries"]>;
  match: MatchDef;
}) {
  const levelId = resolveStageLevelId(
    tournament.stageLevelIds,
    tournament.rounds.findIndex((round) => round.some((m) => m.id === match.id))
  );
  const levelLabel = LEVEL_REGISTRY.find((entry) => entry.id === levelId)?.label ?? levelId;
  const progressEntries = progressByMatch.get(match.id) ?? [];
  const liveEntries = progressEntries
    .map((entry) => {
      const botName = match.participants.find((p) => p.botId === entry.botId)?.name ?? entry.botId;
      const multiplier = computeTimeMultiplier(entry.timeElapsedMs);
      const flatBonus = computeTimeBonus(entry.timeElapsedMs);
      const score = computeScore({
        fruitScore: entry.fruitScore,
        timeElapsedMs: entry.timeElapsedMs,
        deaths: tournament.livesPerRun - entry.livesRemaining,
        reachedGoal: entry.finished,
      });
      return { ...entry, botName, multiplier, flatBonus, score };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="present-hud">
      <div className="present-hud__top">
        <span className="present-hud__level">▶ {levelLabel}</span>
        <span className="present-hud__round">
          Runde {tournament.rounds.findIndex((round) => round.some((m) => m.id === match.id)) + 1}
        </span>
      </div>
      <div className="present-hud__racers">
        {liveEntries.map((entry, index) => {
          const timeRemainingMs = RUN_TIME_LIMIT_MS - entry.timeElapsedMs;
          const isLeader = index === 0 && liveEntries.length > 1;
          return (
            <div
              key={entry.botId}
              className={`present-hud__racer ${isLeader ? "present-hud__racer--leader" : ""}`}
            >
              <span className="present-hud__rank">{index + 1}</span>
              <span className="present-hud__name">{entry.botName}</span>
              <span className="present-hud__fruit" title="Früchte">
                🍒 {entry.fruitScore}
              </span>
              <span className="present-hud__lives" title="Leben">
                ❤️ {formatScoreHudValue(entry.livesRemaining)}
              </span>
              <span className="present-hud__time" title="Restzeit">
                ⏱ {formatSeconds(timeRemainingMs)}
              </span>
              <span className="present-hud__multiplier" title="Zeit-Multiplikator">
                ⚡ ×{entry.multiplier.toFixed(2)}
                {entry.flatBonus > 0 ? ` +${Math.round(entry.flatBonus)}` : ""}
              </span>
              <span className="present-hud__score">{entry.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PresentPage() {
  const { status, send, lastMessage } = useWebSocketConnection("present");
  const { bots, initialized } = useBotRegistry(lastMessage, status);
  const { tournament } = useTournamentSession(lastMessage);
  const progressByMatch = useMatchProgress(lastMessage);

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
    <main className="present-page">
      <header className="present-header">
        <h1 className="present-title">Coin Quest Arena</h1>
        <ConnectionStatusBadge status={status} />
      </header>

      {stage.kind === "no-tournament" && (
        <section className="present-panel">
          <h2>Eingereichte Bots</h2>
          <BotRegistryList bots={bots} />
        </section>
      )}

      {stage.kind === "champion" && tournament && (
        <ChampionView state={tournament} onReset={() => send({ type: "tournament-reset" })} />
      )}

      {stage.kind === "running" && tournament && (
        <div className="present-match-layout">
          <PresentHudBar
            tournament={tournament}
            progressByMatch={progressByMatch}
            match={stage.match}
          />
          <MatchView
            key={stage.match.id}
            match={stage.match}
            levelId={resolveStageLevelId(tournament.stageLevelIds, stage.roundIndex)}
            livesPerRun={tournament.livesPerRun}
            sourceById={sourceById}
            onProgress={handleProgress}
            onFinished={handleFinished}
          />
        </div>
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
