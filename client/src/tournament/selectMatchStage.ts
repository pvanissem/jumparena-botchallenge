import type { MatchDef, TournamentState } from "@arena/shared";

/**
 * Was `/present` (und ergänzend `/admin`) aus dem Turnierzustand gerade
 * anzeigen soll. Bewusst eine reine Funktion ohne React/Phaser, damit die
 * Ableitung testbar ist und beide Ansichten dieselbe Regel nutzen (DRY).
 */
export type MatchStage =
  | { kind: "no-tournament" }
  | { kind: "champion" }
  | { kind: "running"; match: MatchDef; roundIndex: number }
  | { kind: "result"; match: MatchDef; roundIndex: number }
  | { kind: "bracket" };

/** Freilose sind Matches mit genau einem Teilnehmer – für sie gibt es kein
 *  anzuzeigendes Ergebnis, sie wandern direkt in die nächste Runde. */
function isContested(match: MatchDef): boolean {
  return match.participants.length > 1;
}

function findRunningRoundIndex(state: TournamentState): number | null {
  for (const [roundIndex, round] of state.rounds.entries()) {
    if (round.some((match) => match.status === "running")) {
      return roundIndex;
    }
  }
  return null;
}

function findLastFinishedResult(
  state: TournamentState
): { match: MatchDef; roundIndex: number } | null {
  let latest: { match: MatchDef; roundIndex: number } | null = null;
  for (const [roundIndex, round] of state.rounds.entries()) {
    for (const match of round) {
      if (match.status === "finished" && match.result !== null && isContested(match)) {
        latest = { match, roundIndex };
      }
    }
  }
  return latest;
}

export function selectMatchStage(state: TournamentState | null): MatchStage {
  if (!state) return { kind: "no-tournament" };
  if (state.status === "finished") return { kind: "champion" };

  const runningRoundIndex = findRunningRoundIndex(state);
  if (runningRoundIndex !== null) {
    const running = state.rounds[runningRoundIndex].find((match) => match.status === "running");
    if (!running) return { kind: "bracket" };
    return { kind: "running", match: running, roundIndex: runningRoundIndex };
  }

  // Zuletzt beendetes, echtes Match: dessen Ergebnis wird gezeigt, bis der
  // Standbetreuer das nächste Match startet.
  const lastFinished = findLastFinishedResult(state);
  if (lastFinished)
    return { kind: "result", match: lastFinished.match, roundIndex: lastFinished.roundIndex };

  return { kind: "bracket" };
}
