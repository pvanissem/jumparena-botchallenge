import type { MatchProgressMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createMatchProgressHandler(
  session: TournamentSessionService,
  routeToAll: (message: MatchProgressMessage) => void
): MessageHandler<MatchProgressMessage> {
  return (senderId, message) => {
    if (session.acceptProgress(senderId, message)) routeToAll(message);
  };
}
