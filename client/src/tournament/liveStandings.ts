import type { MatchDef, MatchProgressMessage } from "@arena/shared";
import { computeScore } from "../game/scoring";

export type LiveStandingStatus = "racing" | "finished" | "dnf" | "disabled";

export interface LiveStanding {
  botId: string;
  name: string;
  color: string;
  rank: number;
  score: number;
  progress: number;
  livesRemaining: number;
  timeElapsedMs: number;
  status: LiveStandingStatus;
}

function statusOf(entry: MatchProgressMessage["entries"][number]): LiveStandingStatus {
  if (entry.disabled) return "disabled";
  if (entry.didNotFinish) return "dnf";
  if (entry.finished) return "finished";
  return "racing";
}

export function buildLiveStandings(
  match: MatchDef,
  entries: MatchProgressMessage["entries"],
  livesPerRun: number
): LiveStanding[] {
  const progressByBotId = new Map(entries.map((entry) => [entry.botId, entry]));
  const standings = match.participants.map((participant) => {
    const entry = progressByBotId.get(participant.botId);
    if (!entry) {
      return {
        botId: participant.botId,
        name: participant.name,
        color: participant.color,
        rank: 0,
        score: 0,
        progress: 0,
        livesRemaining: livesPerRun,
        timeElapsedMs: 0,
        status: "racing" as const,
      };
    }

    return {
      botId: participant.botId,
      name: participant.name,
      color: participant.color,
      rank: 0,
      score: computeScore({
        fruitScore: entry.fruitScore,
        timeElapsedMs: entry.timeElapsedMs,
        deaths: Math.max(0, livesPerRun - entry.livesRemaining),
        reachedGoal: entry.finished,
      }),
      progress: entry.progress,
      livesRemaining: entry.livesRemaining,
      timeElapsedMs: entry.timeElapsedMs,
      status: statusOf(entry),
    };
  });

  standings.sort(
    (left, right) =>
      right.score - left.score ||
      right.progress - left.progress ||
      left.timeElapsedMs - right.timeElapsedMs ||
      left.botId.localeCompare(right.botId)
  );
  return standings.map((standing, index) => ({ ...standing, rank: index + 1 }));
}
