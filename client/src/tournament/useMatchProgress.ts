import type { MatchProgressMessage } from "@arena/shared";
import { useEffect, useState } from "react";
import type { OutboundMessageSubscriber } from "../ws/useWebSocketConnection";

/**
 * React hook that keeps the latest `match-progress` entries per match ID.
 */
export function useMatchProgress(
  subscribe: OutboundMessageSubscriber
): Map<string, MatchProgressMessage["entries"]> {
  const [progressByMatch, setProgressByMatch] = useState<
    Map<string, MatchProgressMessage["entries"]>
  >(new Map());

  useEffect(
    () =>
      subscribe((message) => {
        if (message.type !== "match-progress") return;

        setProgressByMatch((previous) => {
          const next = new Map(previous);
          next.set(message.matchId, message.entries);
          return next;
        });
      }),
    [subscribe]
  );

  return progressByMatch;
}
