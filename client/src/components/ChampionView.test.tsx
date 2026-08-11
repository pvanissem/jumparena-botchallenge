import type { TournamentState } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChampionView } from "./ChampionView";

afterEach(cleanup);

describe("ChampionView", () => {
  it("renders a celebration without requiring a present-side reset action", () => {
    const state = {
      championBotId: "b1",
      rounds: [[{ participants: [{ botId: "b1", name: "Alpha", author: "Ada" }] }]],
    } as TournamentState;
    render(<ChampionView state={state} />);
    expect(screen.getByRole("heading", { name: /Champion/ })).toBeTruthy();
    expect(screen.getByText(/Alpha/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
