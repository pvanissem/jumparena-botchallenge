import type {
  ShowHoldReason,
  TournamentShowPhase,
  TournamentShowState,
} from "@arena/shared";

export type TimedTournamentShowPhase =
  | "matchup-intro"
  | "countdown"
  | "match-result"
  | "bracket-update";

export function enterTimedPhase(
  state: TournamentShowState,
  phase: TimedTournamentShowPhase,
  nowMs: number,
  durationMs: number
): TournamentShowState {
  return {
    ...state,
    phase,
    phaseEndsAtMs: nowMs + durationMs,
    heldRemainingMs: null,
    holds: [],
  };
}

export function enterUntimedPhase(
  state: TournamentShowState,
  phase: Exclude<TournamentShowPhase, TimedTournamentShowPhase>
): TournamentShowState {
  return {
    ...state,
    phase,
    phaseEndsAtMs: null,
    heldRemainingMs: null,
    holds: [],
  };
}

export function addShowHold(
  state: TournamentShowState,
  reason: ShowHoldReason,
  nowMs: number
): TournamentShowState {
  if (state.holds.includes(reason)) return state;

  const isFirstHold = state.holds.length === 0;
  return {
    ...state,
    phaseEndsAtMs: isFirstHold ? null : state.phaseEndsAtMs,
    heldRemainingMs:
      isFirstHold && state.phaseEndsAtMs !== null
        ? Math.max(0, state.phaseEndsAtMs - nowMs)
        : state.heldRemainingMs,
    holds: [...state.holds, reason],
  };
}

export function removeShowHold(
  state: TournamentShowState,
  reason: ShowHoldReason,
  nowMs: number
): TournamentShowState {
  if (!state.holds.includes(reason)) return state;

  const holds = state.holds.filter((hold) => hold !== reason);
  if (holds.length > 0) return { ...state, holds };

  return {
    ...state,
    holds,
    phaseEndsAtMs:
      state.heldRemainingMs === null ? null : nowMs + Math.max(0, state.heldRemainingMs),
    heldRemainingMs: null,
  };
}

export function canAdvance(state: TournamentShowState): boolean {
  return (
    state.phase === "matchup-intro" ||
    state.phase === "countdown" ||
    state.phase === "match-result" ||
    state.phase === "bracket-update"
  );
}
