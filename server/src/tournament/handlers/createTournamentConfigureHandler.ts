import type { TournamentConfigureMessage } from "@arena/shared";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createTournamentConfigureHandler(
  session: TournamentSessionService,
  clients: ClientRegistry
): MessageHandler<TournamentConfigureMessage> {
  return (senderId, message) => {
    if (clients.roleOf(senderId) === "admin") session.configure(message);
  };
}
