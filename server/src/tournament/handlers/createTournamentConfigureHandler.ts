import type { TournamentConfigureMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentService } from "../TournamentService";

export function createTournamentConfigureHandler(
  service: TournamentService,
  broadcastState: () => void
): MessageHandler<TournamentConfigureMessage> {
  return (_senderId, message) => {
    const state = service.configure(message);
    if (state) {
      broadcastState();
    }
  };
}
