import type { MatchDef } from "@arena/shared";

export type RoundStatus = "pending" | "running" | "finished";

/** Bestimmt den Fortschrittsstatus einer Runde aus ihren Matches (US-4). */
export function computeRoundStatus(round: readonly MatchDef[]): RoundStatus {
  if (round.length === 0) {
    return "pending";
  }
  if (round.some((match) => match.status === "running")) {
    return "running";
  }
  if (round.every((match) => match.status === "finished")) {
    return "finished";
  }
  if (round.some((match) => match.status === "finished")) {
    return "running";
  }
  return "pending";
}
