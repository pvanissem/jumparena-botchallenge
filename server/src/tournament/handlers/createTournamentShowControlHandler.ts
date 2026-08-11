import type { TournamentShowControlMessage } from "@arena/shared";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createTournamentShowControlHandler(
  session: TournamentSessionService,
  clients: ClientRegistry
): MessageHandler<TournamentShowControlMessage> {
  return (senderId, message) => {
    if (clients.roleOf(senderId) === "admin") session.control(message.action);
  };
}
