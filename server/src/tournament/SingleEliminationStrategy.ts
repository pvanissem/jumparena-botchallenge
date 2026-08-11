import { randomUUID } from "node:crypto";
import type {
  MatchDef,
  MatchParticipant,
  MatchResult,
  MatchResultEntry,
  TournamentState,
} from "@arena/shared";
import type { CreateRoundsOptions, TournamentStrategy } from "./TournamentStrategy";

export function createMatchId(): string {
  // Kurze, URL-sichere IDs (Server-only, daher Node-Crypto).
  return randomUUID();
}

function chunk<T>(array: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function createByeResult(participant: MatchParticipant): MatchResult {
  const entry: MatchResultEntry = {
    botId: participant.botId,
    rank: 1,
    score: 0,
    fruitScore: 0,
    coinsCollected: 0,
    deaths: 0,
    timeElapsedMs: 0,
    reachedGoal: false,
    disabled: false,
  };
  return { entries: [entry] };
}

function defaultShuffle<T>(array: readonly T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class SingleEliminationStrategy implements TournamentStrategy {
  readonly mode = "single-elimination";

  constructor(
    private readonly shuffle: <T>(array: readonly T[]) => T[] = defaultShuffle,
    private readonly createId: () => string = createMatchId
  ) {}

  createRounds(participants: MatchParticipant[], options: CreateRoundsOptions): MatchDef[][] {
    const { groupSize } = options;
    const shuffled = this.shuffle(participants);
    const groups = chunk(shuffled, groupSize);
    const matches: MatchDef[] = groups.map((group) => {
      const id = this.createId();
      if (group.length === 1) {
        return {
          id,
          participants: group,
          status: "finished",
          result: createByeResult(group[0]),
        };
      }
      return {
        id,
        participants: group,
        status: "pending",
        result: null,
      };
    });
    return [matches];
  }

  advance(state: TournamentState, matchId: string, result: MatchResult): TournamentState {
    const rounds = state.rounds.map((round) => round.map((match) => ({ ...match })));
    const currentRoundIndex = rounds.findIndex((round) =>
      round.some((match) => match.id === matchId)
    );
    if (currentRoundIndex < 0) return state;

    const currentRound = rounds[currentRoundIndex];
    const runningMatch = currentRound.find(
      (match) => match.id === matchId && match.status === "running"
    );
    if (!runningMatch) return state;

    runningMatch.result = result;
    runningMatch.status = "finished";

    if (!currentRound.every((match) => match.status === "finished")) {
      return { ...state, rounds, status: state.status === "idle" ? "running" : state.status };
    }

    const winners: MatchParticipant[] = currentRound.map((match) => {
      const winnerEntry = match.result?.entries.find((entry) => entry.rank === 1);
      if (!winnerEntry) {
        // Fallback should never happen: every finished match must have a rank 1.
        throw new Error(`Match ${match.id} finished without a rank-1 entry`);
      }
      const participant = match.participants.find((p) => p.botId === winnerEntry.botId);
      if (!participant) {
        throw new Error(`Winner ${winnerEntry.botId} not found in match ${match.id}`);
      }
      return participant;
    });

    if (winners.length === 1) {
      return {
        ...state,
        rounds,
        status: "finished",
        championBotId: winners[0].botId,
      };
    }

    const nextRound = this.createRoundFromParticipants(winners, state.groupSize);
    rounds.push(nextRound);

    return { ...state, rounds, status: "running" };
  }

  private createRoundFromParticipants(
    participants: MatchParticipant[],
    groupSize: number
  ): MatchDef[] {
    const groups = chunk(participants, groupSize);
    return groups.map((group) => ({
      id: this.createId(),
      participants: group,
      status: group.length === 1 ? "finished" : "pending",
      result: group.length === 1 ? createByeResult(group[0]) : null,
    }));
  }
}
