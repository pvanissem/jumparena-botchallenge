import type { TournamentShowState } from "@arena/shared";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useShowAudioCue } from "./useShowAudioCue";

describe("useShowAudioCue", () => {
  it("plays a cue once per phase and match transition", () => {
    const play = vi.fn(() => Promise.resolve());
    const intro = { phase: "matchup-intro", activeMatchId: "m1" } as TournamentShowState;
    const { rerender } = renderHook(
      ({ show }: { show: TournamentShowState | null }) => useShowAudioCue(show, play),
      { initialProps: { show: intro } }
    );
    rerender({ show: intro });
    rerender({ show: { ...intro, phase: "match-result" } });

    expect(play).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenNthCalledWith(1, "/assets/Audio/boingo.mp3", expect.any(Number));
    expect(play).toHaveBeenNthCalledWith(2, "/assets/Audio/complete.mp3", expect.any(Number));
  });
});
