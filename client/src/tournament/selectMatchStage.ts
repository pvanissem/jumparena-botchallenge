import type { MatchDef, TournamentState } from "@arena/shared";

/**
 * Was `/present` (und ergänzend `/admin`) aus dem Turnierzustand gerade
 * anzeigen soll. Bewusst eine reine Funktion ohne React/Phaser, damit die
 * Ableitung testbar ist und beide Ansichten dieselbe Regel nutzen (DRY).
 */
export type MatchStage =
  | { kind: "no-tournament" }
  | { kind: "champion" }
  | { kind: "running"; match: MatchDef }
  | { kind: "result"; match: MatchDef }
  | { kind: "bracket" };

/** Freilose sind Matches mit genau einem Teilnehmer – für sie gibt es kein
 *  anzuzeigendes Ergebnis, sie wandern direkt in die nächste Runde. */
function isContested(match: MatchDef): boolean {
  return match.participants.length > 1;
}

export function selectMatchStage(state: TournamentState | null): MatchStage {
  if (!state) return { kind: "no-tournament" };
  if (state.status === "finished") return { kind: "champion" };

  const matches = state.rounds.flat();

  const running = matches.find((match) => match.status === "running");
  if (running) return { kind: "running", match: running };

  // Zuletzt beendetes, echtes Match: dessen Ergebnis wird gezeigt, bis der
  // Standbetreuer das nächste Match startet (US-6).
  const lastFinished = matches
    .filter((match) => match.status === "finished" && match.result !== null && isContested(match))
    .at(-1);

  if (lastFinished) return { kind: "result", match: lastFinished };

  return { kind: "bracket" };
}
