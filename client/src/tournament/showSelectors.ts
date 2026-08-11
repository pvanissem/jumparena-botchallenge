import type { MatchDef, TournamentShowState, TournamentState } from "@arena/shared";

export interface VisibleRoundRange {
  startIndex: number;
  endIndex: number;
}

export interface ActiveMatchSelection {
  match: MatchDef;
  roundIndex: number;
}

export function selectVisibleRoundRange(
  roundCount: number,
  activeRoundIndex: number
): VisibleRoundRange {
  if (roundCount <= 3) return { startIndex: 0, endIndex: Math.max(0, roundCount - 1) };
  const startIndex = Math.min(Math.max(0, activeRoundIndex - 1), roundCount - 3);
  return { startIndex, endIndex: startIndex + 2 };
}

export function countCompletedMatches(state: TournamentState): number {
  return state.rounds.flat().filter((match) => match.status === "finished").length;
}

export function countRemainingBots(state: TournamentState): number {
  const allBotIds = new Set(
    state.rounds.flatMap((round) =>
      round.flatMap((match) => match.participants.map((participant) => participant.botId))
    )
  );
  const eliminatedBotIds = new Set<string>();
  for (const match of state.rounds.flat()) {
    if (match.status !== "finished") continue;
    const winnerId = match.result?.entries.find((entry) => entry.rank === 1)?.botId;
    for (const participant of match.participants) {
      if (participant.botId !== winnerId) eliminatedBotIds.add(participant.botId);
    }
  }
  return allBotIds.size - eliminatedBotIds.size;
}

export function selectActiveMatch(
  state: TournamentState | null,
  show: TournamentShowState | null
): ActiveMatchSelection | null {
  if (!state || !show?.activeMatchId) return null;
  for (const [roundIndex, round] of state.rounds.entries()) {
    const match = round.find((candidate) => candidate.id === show.activeMatchId);
    if (match) return { match, roundIndex };
  }
  return null;
}
