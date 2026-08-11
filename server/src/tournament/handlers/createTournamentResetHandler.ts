import type { TournamentResetMessage } from "@arena/shared";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createTournamentResetHandler(
  session: TournamentSessionService,
  clients: ClientRegistry
): MessageHandler<TournamentResetMessage> {
  return (senderId) => {
    if (clients.roleOf(senderId) === "admin") session.reset();
  };
}
