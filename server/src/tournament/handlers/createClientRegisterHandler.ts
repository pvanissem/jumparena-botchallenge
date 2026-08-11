import type { ClientRegisteredMessage, ClientRegisterMessage } from "@arena/shared";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createClientRegisterHandler(
  clients: ClientRegistry,
  session: TournamentSessionService,
  sendToClient: (clientId: string, message: ClientRegisteredMessage) => void
): MessageHandler<ClientRegisterMessage> {
  return (senderId, message) => {
    clients.registerRole(senderId, message.role);
    sendToClient(senderId, {
      type: "client-registered",
      clientId: senderId,
      role: message.role,
    });
    session.onPresentAvailabilityChanged();
  };
}
