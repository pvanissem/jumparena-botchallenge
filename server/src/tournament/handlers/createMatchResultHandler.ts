import type { MatchResultMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createMatchResultHandler(
  session: TournamentSessionService
): MessageHandler<MatchResultMessage> {
  return (senderId, message) => {
    session.acceptResult(senderId, message);
  };
}
