import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LiveStanding } from "../../tournament/liveStandings";
import { LiveScoreboard } from "./LiveScoreboard";

afterEach(cleanup);

const standings: LiveStanding[] = [
  {
    botId: "b1",
    name: "Turbo Bot",
    color: "#00ffff",
    rank: 1,
    score: 123,
    progress: 0.42,
    livesRemaining: 2,
    timeElapsedMs: 1_500,
    status: "racing",
  },
];

describe("LiveScoreboard", () => {
  it("renders all live metrics and status accessibly", () => {
    const { container } = render(<LiveScoreboard standings={standings} variant="present" />);

    const row = screen.getByRole("listitem", { name: /Platz 1.*Turbo Bot/ });
    expect(row.textContent).toContain("123");
    expect(row.textContent).toContain("42%");
    expect(row.textContent).toContain("2");
    expect(row.textContent).toContain("88.5s");
    expect(row.textContent).toContain("Im Rennen");
    expect(row.getAttribute("data-leader")).toBe("true");
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe("present");
  });
});
