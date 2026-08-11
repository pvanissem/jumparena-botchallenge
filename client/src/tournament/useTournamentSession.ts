import type { TournamentShowState, TournamentState } from "@arena/shared";
import { useEffect, useState } from "react";
import type { OutboundMessageSubscriber } from "../ws/useWebSocketConnection";

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

export function useTournamentSession(subscribe: OutboundMessageSubscriber): TournamentSession {
  const [session, setSession] = useState(EMPTY_SESSION);

  useEffect(
    () =>
      subscribe((message) => {
        if (message.type !== "tournament-state") return;
        setSession({
          tournament: message.state,
          show: message.show,
          clockOffsetMs: message.serverNowMs - Date.now(),
        });
      }),
    [subscribe]
  );

  return session;
}
