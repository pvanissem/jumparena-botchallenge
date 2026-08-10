import type { TournamentResetMessage } from "@arena/shared";
import type { MessageHandler } from "../../ws/MessageDispatcher";
import type { TournamentService } from "../TournamentService";

export function createTournamentResetHandler(
  service: TournamentService,
  broadcastState: () => void
): MessageHandler<TournamentResetMessage> {
  return (_senderId, _message) => {
    service.reset();
    broadcastState();
  };
}
