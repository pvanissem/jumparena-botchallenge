import type { MatchProgressMessage, OutboundMessage } from "@arena/shared";
import { useEffect, useState } from "react";

/**
 * React hook that keeps the latest `match-progress` entries per match ID.
 */
export function useMatchProgress(
  lastMessage: OutboundMessage | null
): Map<string, MatchProgressMessage["entries"]> {
  const [progressByMatch, setProgressByMatch] = useState<
    Map<string, MatchProgressMessage["entries"]>
  >(new Map());

  useEffect(() => {
    if (lastMessage?.type !== "match-progress") return;

    setProgressByMatch((previous) => {
      const next = new Map(previous);
      next.set(lastMessage.matchId, lastMessage.entries);
      return next;
    });
  }, [lastMessage]);

  return progressByMatch;
}
