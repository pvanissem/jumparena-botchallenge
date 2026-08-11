import type { MatchResult, TournamentState } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatchResultView } from "./MatchResultView";

afterEach(cleanup);

describe("MatchResultView", () => {
  it("highlights the winner and score breakdown", () => {
    const result = {
      entries: [
        {
          botId: "b1",
          rank: 1,
          score: 99,
          fruitScore: 10,
          coinsCollected: 2,
          deaths: 0,
          timeElapsedMs: 1000,
          reachedGoal: true,
          disabled: false,
        },
      ],
    } satisfies MatchResult;
    const state = {
      rounds: [[{ participants: [{ botId: "b1", name: "Alpha" }] }]],
      status: "running",
    } as TournamentState;
    render(<MatchResultView result={result} state={state} />);
    expect(screen.getByRole("heading", { name: /Alpha gewinnt/ })).toBeTruthy();
    expect(screen.getByText(/99 PTS/)).toBeTruthy();
  });
});
