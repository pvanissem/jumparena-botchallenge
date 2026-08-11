import type { TournamentShowPhase, TournamentShowState, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { AUDIO_KEYS } from "../assets/audio";
import { selectTournamentMusicKey } from "./tournamentMusic";

function tournament(roundCount: number): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-1"],
    livesPerRun: 3,
    groupSize: 2,
    rounds: Array.from({ length: roundCount }, () => []),
    status: "running",
    championBotId: null,
  };
}

function show(phase: TournamentShowPhase, activeRoundIndex: number | null): TournamentShowState {
  return {
    phase,
    activeMatchId: activeRoundIndex === null ? null : "match-1",
    activeRoundIndex,
    matchAttemptId: phase === "match-running" ? "attempt-1" : null,
    executorClientId: null,
    phaseEndsAtMs: null,
    heldRemainingMs: null,
    holds: [],
    presentReady: true,
  };
}

describe("selectTournamentMusicKey", () => {
  it.each([
    [0, "theme"],
    [1, "theme2"],
    [2, "theme3"],
    [3, "epic"],
  ] as const)("selects %s rounds from the opening round as %s", (roundIndex, expected) => {
    expect(selectTournamentMusicKey(tournament(4), show("match-running", roundIndex))).toBe(
      expected
    );
  });

  it.each([
    "ready",
    "matchup-intro",
    "countdown",
    "match-result",
    "bracket-update",
    "champion",
  ] as const)("plays end music during %s", (phase) => {
    expect(selectTournamentMusicKey(tournament(4), show(phase, 1))).toBe("end");
  });

  it("starts a two-round tournament at the semifinal track", () => {
    expect(selectTournamentMusicKey(tournament(2), show("match-running", 0))).toBe("theme3");
  });

  it("falls back to the base theme for invalid running state", () => {
    expect(selectTournamentMusicKey(tournament(4), show("match-running", null))).toBe(
      AUDIO_KEYS.THEME
    );
  });

  it("stays silent before tournament and show state exist", () => {
    expect(selectTournamentMusicKey(null, null)).toBeNull();
    expect(selectTournamentMusicKey(tournament(4), null)).toBeNull();
  });
});
