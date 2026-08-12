import type { TournamentShowState, TournamentState } from "@arena/shared";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AUDIO_KEYS } from "../assets/audio";
import { useTournamentMusic } from "./useTournamentMusic";

vi.mock("phaser", () => ({
  default: {
    HEADLESS: 3,
    Game: class {},
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
    Sound: { Events: { UNLOCKED: "unlocked" } },
  },
}));

const tournament: TournamentState = {
  mode: "single-elimination",
  stageLevelIds: ["level-1"],
  livesPerRun: 3,
  groupSize: 2,
  rounds: [[], [], []],
  status: "running",
  championBotId: null,
};

function show(phase: TournamentShowState["phase"], roundIndex: number): TournamentShowState {
  return {
    phase,
    activeMatchId: "match-1",
    activeRoundIndex: roundIndex,
    matchAttemptId: phase === "match-running" ? "attempt-1" : null,
    executorClientId: null,
    phaseEndsAtMs: null,
    heldRemainingMs: null,
    holds: [],
    presentReady: true,
  };
}

describe("useTournamentMusic", () => {
  it("owns one runtime and forwards only actual track changes", () => {
    const runtime = { setTrack: vi.fn(), destroy: vi.fn() };
    const factory = vi.fn(() => runtime);
    const ready = show("ready", 0);
    const { rerender, unmount } = renderHook(
      ({ currentShow }) => useTournamentMusic(tournament, currentShow, factory),
      { initialProps: { currentShow: ready } }
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(runtime.setTrack).toHaveBeenLastCalledWith(AUDIO_KEYS.END);

    rerender({ currentShow: show("match-running", 2) });
    expect(runtime.setTrack).toHaveBeenLastCalledWith(AUDIO_KEYS.EPIC);

    const callsAfterTrackChange = runtime.setTrack.mock.calls.length;
    rerender({ currentShow: show("match-running", 2) });
    expect(runtime.setTrack).toHaveBeenCalledTimes(callsAfterTrackChange);

    unmount();
    expect(runtime.destroy).toHaveBeenCalledTimes(1);
  });
});
