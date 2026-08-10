import type { MatchStartMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentService } from "../TournamentService";

export function createMatchStartHandler(
  service: TournamentService,
  broadcastState: () => void
): MessageHandler<MatchStartMessage> {
  return (_senderId, message) => {
    const started = service.startMatch(message.matchId);
    if (started) {
      broadcastState();
    }
  };
}
