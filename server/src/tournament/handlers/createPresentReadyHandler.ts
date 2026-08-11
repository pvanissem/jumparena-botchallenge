import type { PresentReadyMessage } from "@arena/shared";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createPresentReadyHandler(
  clients: ClientRegistry,
  session: TournamentSessionService
): MessageHandler<PresentReadyMessage> {
  return (senderId, message) => {
    if (clients.roleOf(senderId) !== "present") return;
    clients.setPresentReady(senderId, message.ready);
    session.onPresentAvailabilityChanged();
  };
}
