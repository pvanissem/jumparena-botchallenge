import type { BotArtifact, OutboundMessage } from "@arena/shared";
import { useEffect, useReducer } from "react";

type RegistryAction =
  | { type: "snapshot"; bots: BotArtifact[] }
  | { type: "added"; bot: BotArtifact }
  | { type: "removed"; id: string };

function reducer(state: BotArtifact[], action: RegistryAction): BotArtifact[] {
  switch (action.type) {
    case "snapshot":
      return action.bots;
    case "added": {
      if (state.some((bot) => bot.id === action.bot.id)) {
        return state;
      }
      return [...state, action.bot];
    }
    case "removed":
      return state.filter((bot) => bot.id !== action.id);
    default:
      return state;
  }
}

/**
 * React hook that derives the shared bot registry state from outgoing
 * WebSocket messages. Keeps upload errors (local, ephemeral) out of this
 * shared, server-authoritative state.
 */
export function useBotRegistry(lastMessage: OutboundMessage | null): BotArtifact[] {
  const [bots, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "bot-registry-snapshot":
        dispatch({ type: "snapshot", bots: lastMessage.bots });
        break;
      case "bot-added":
        dispatch({ type: "added", bot: lastMessage.bot });
        break;
      case "bot-removed":
        dispatch({ type: "removed", id: lastMessage.id });
        break;
    }
  }, [lastMessage]);

  return bots;
}
