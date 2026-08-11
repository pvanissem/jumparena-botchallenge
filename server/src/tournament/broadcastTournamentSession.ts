import type { TournamentStateMessage } from "@arena/shared";
import type { TournamentSessionSnapshot } from "./TournamentSessionService";

export function createTournamentSessionBroadcaster(
  send: (message: TournamentStateMessage) => void
): (snapshot: TournamentSessionSnapshot, serverNowMs: number) => void {
  return (snapshot, serverNowMs) => {
    send({ type: "tournament-state", ...snapshot, serverNowMs });
  };
}
