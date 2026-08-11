import type { TournamentShowState } from "@arena/shared";
import { useEffect, useState } from "react";

export function useShowCountdown(
  show: TournamentShowState | null,
  clockOffsetMs: number
): number | null {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const phaseEndsAtMs = show?.phaseEndsAtMs ?? null;
  const isHeld = (show?.holds.length ?? 0) > 0;

  useEffect(() => {
    setNowMs(Date.now());
    if (phaseEndsAtMs === null || isHeld) return;
    const handle = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(handle);
  }, [isHeld, phaseEndsAtMs]);

  if (!show || show.phaseEndsAtMs === null || show.holds.length > 0) return null;
  return Math.max(0, Math.ceil((show.phaseEndsAtMs - (nowMs + clockOffsetMs)) / 1_000));
}
