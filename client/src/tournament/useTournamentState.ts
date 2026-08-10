import type { OutboundMessage, TournamentState } from "@arena/shared";
import { useEffect, useState } from "react";

/**
 * React hook that derives the shared tournament state from outgoing
 * WebSocket messages (`tournament-state`).
 */
export function useTournamentState(lastMessage: OutboundMessage | null): TournamentState | null {
  const [state, setState] = useState<TournamentState | null>(null);

  useEffect(() => {
    if (lastMessage?.type === "tournament-state") {
      setState(lastMessage.state);
    }
  }, [lastMessage]);

  return state;
}
