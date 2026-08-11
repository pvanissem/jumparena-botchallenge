import type { BotArtifact, OutboundMessage } from "@arena/shared";
import { useEffect, useReducer } from "react";
import type { ConnectionStatus } from "../ws/WebSocketClient";

type RegistryAction =
  | { type: "snapshot"; bots: BotArtifact[] }
  | { type: "added"; bot: BotArtifact }
  | { type: "removed"; id: string }
  | { type: "reset" };

export interface BotRegistryState {
  bots: BotArtifact[];
  initialized: boolean;
}

const EMPTY_REGISTRY: BotRegistryState = { bots: [], initialized: false };

function reducer(state: BotRegistryState, action: RegistryAction): BotRegistryState {
  switch (action.type) {
    case "snapshot":
      return { bots: action.bots, initialized: true };
    case "added": {
      if (state.bots.some((bot) => bot.id === action.bot.id)) {
        return state;
      }
      return { ...state, bots: [...state.bots, action.bot] };
    }
    case "removed":
      return { ...state, bots: state.bots.filter((bot) => bot.id !== action.id) };
    case "reset":
      return EMPTY_REGISTRY;
    default:
      return state;
  }
}

/**
 * React hook that derives the shared bot registry state from outgoing
 * WebSocket messages. Keeps upload errors (local, ephemeral) out of this
 * shared, server-authoritative state.
 */
export function useBotRegistry(
  subscribe: (listener: (message: OutboundMessage) => void) => () => void,
  connectionStatus: ConnectionStatus
): BotRegistryState {
  const [state, dispatch] = useReducer(reducer, EMPTY_REGISTRY);

  useEffect(() => {
    if (connectionStatus !== "connected") dispatch({ type: "reset" });
  }, [connectionStatus]);

  useEffect(
    () =>
      subscribe((message) => {
        switch (message.type) {
          case "bot-registry-snapshot":
            dispatch({ type: "snapshot", bots: message.bots });
            break;
          case "bot-added":
            dispatch({ type: "added", bot: message.bot });
            break;
          case "bot-removed":
            dispatch({ type: "removed", id: message.id });
            break;
        }
      }),
    [subscribe]
  );

  return state;
}
