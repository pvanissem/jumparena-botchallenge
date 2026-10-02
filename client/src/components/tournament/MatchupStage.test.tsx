import type { MatchDef } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatchupStage } from "./MatchupStage";

afterEach(cleanup);

function match(count: number): MatchDef {
  return {
    id: "m1",
    participants: Array.from({ length: count }, (_, index) => ({
      botId: `b${index}`,
      name: `Bot ${index + 1}`,
      author: `Team ${index + 1}`,
      color: "#00ffff",
    })),
    status: "pending",
    result: null,
  };
}

describe("MatchupStage", () => {
  it("restarts only the countdown digit when its value changes", () => {
    const current = match(4);
    const { rerender } = render(<MatchupStage match={current} roundLabel="Finale" countdown={3} />);
    const cards = screen.getAllByRole("article");
    const three = screen.getByRole("timer");
    rerender(<MatchupStage match={{ ...current }} roundLabel="Finale" countdown={3} />);
    expect(screen.getByRole("timer")).toBe(three);
    rerender(<MatchupStage match={current} roundLabel="Finale" countdown={2} />);
    expect(screen.getByRole("timer")).not.toBe(three);
    expect(screen.getByRole("timer").textContent).toBe("2");
    screen.getAllByRole("article").forEach((card, index) => {
      expect(card).toBe(cards[index]);
    });
  });

  it.each([2, 3, 4])("renders a %s-player matchup", (count) => {
    const { container } = render(
      <MatchupStage match={match(count)} roundLabel="Halbfinale" countdown={null} />
    );
    expect(screen.getAllByRole("article")).toHaveLength(count);
    expect(screen.getByRole("region", { name: "Matchup" })).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("data-participant-count")).toBe(String(count));
  });

  it("renders the corrected countdown", () => {
    render(<MatchupStage match={match(2)} roundLabel="Finale" countdown={3} />);
    expect(screen.getByText("3").getAttribute("aria-label")).toBe("Start in 3 Sekunden");
  });
});
