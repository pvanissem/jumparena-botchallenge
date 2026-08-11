import type { MatchDef, TournamentState } from "@arena/shared";

export interface PendingMatchSelection {
  match: MatchDef;
  roundIndex: number;
}

export function selectNextPendingMatch(state: TournamentState): PendingMatchSelection | null {
  for (const [roundIndex, round] of state.rounds.entries()) {
    const match = round.find(
      (candidate) => candidate.status === "pending" && candidate.participants.length > 1
    );
    if (match) return { match, roundIndex };
  }
  return null;
}
