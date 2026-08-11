import type { OutboundMessage, TournamentShowState, TournamentState } from "@arena/shared";
import { useEffect, useState } from "react";

export interface TournamentSession {
  tournament: TournamentState | null;
  show: TournamentShowState | null;
  clockOffsetMs: number;
}

const EMPTY_SESSION: TournamentSession = {
  tournament: null,
  show: null,
  clockOffsetMs: 0,
};

export function useTournamentSession(lastMessage: OutboundMessage | null): TournamentSession {
  const [session, setSession] = useState(EMPTY_SESSION);

  useEffect(() => {
    if (lastMessage?.type !== "tournament-state") return;
    setSession({
      tournament: lastMessage.state,
      show: lastMessage.show,
      clockOffsetMs: lastMessage.serverNowMs - Date.now(),
    });
  }, [lastMessage]);

  return session;
}
