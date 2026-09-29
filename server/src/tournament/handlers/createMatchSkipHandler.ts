import type { MatchSkipMessage } from "@arena/shared";
import type { ClientRegistry } from "../../ws/ClientRegistry";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentSessionService } from "../TournamentSessionService";

export function createMatchSkipHandler(
  session: TournamentSessionService,
  clients: ClientRegistry
): MessageHandler<MatchSkipMessage> {
  return (senderId, message) => {
    if (clients.roleOf(senderId) !== "admin") return;
    const { show } = session.getSnapshot();
    if (
      show?.phase !== "match-running" ||
      show.activeMatchId !== message.matchId ||
      show.matchAttemptId !== message.matchAttemptId
    )
      return;

    clients
      .getReadyPresentClients()
      .find((client) => client.id === show.executorClientId)
      ?.send(message);
  };
}
