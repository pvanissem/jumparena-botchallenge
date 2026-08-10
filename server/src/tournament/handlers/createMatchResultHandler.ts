import type { MatchResultMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentService } from "../TournamentService";

export function createMatchResultHandler(
  service: TournamentService,
  broadcastState: () => void
): MessageHandler<MatchResultMessage> {
  return (_senderId, message) => {
    const accepted = service.submitResult(message.matchId, message.result);
    if (accepted) {
      broadcastState();
    }
  };
}
