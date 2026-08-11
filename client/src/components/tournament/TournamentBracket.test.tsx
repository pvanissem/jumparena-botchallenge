import type { MatchDef, TournamentShowState, TournamentState } from "@arena/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TournamentBracket } from "./TournamentBracket";

afterEach(cleanup);

function match(id: string, status: MatchDef["status"], winnerId?: string): MatchDef {
  const participants = ["alpha", "beta"].map((suffix) => ({
    botId: `${id}-${suffix}`,
    name: `${id} ${suffix}`,
    author: "A",
    color: suffix === "alpha" ? "#00ffff" : "#ff00ff",
  }));
  return {
    id,
    participants,
    status,
    result: winnerId
      ? {
          entries: participants.map((participant) => ({
            botId: participant.botId,
            rank: participant.botId === winnerId ? 1 : 2,
            score: 0,
            fruitScore: 0,
            coinsCollected: 0,
            deaths: 0,
            timeElapsedMs: 0,
            reachedGoal: false,
            disabled: false,
          })),
        }
      : null,
  };
}

function state(firstRound: MatchDef[], groupSize = 2): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-one", "level-two"],
    livesPerRun: 3,
    groupSize,
    rounds: [firstRound],
    status: "running",
    championBotId: null,
  };
}

describe("TournamentBracket", () => {
  it("renders round headings, statuses, winner and synthetic future slots", () => {
    const finished = match("m1", "finished", "m1-alpha");
    const running = match("m2", "running");
    render(
      <TournamentBracket
        state={state([finished, running, match("m3", "pending"), match("m4", "pending")])}
        show={{ activeMatchId: "m2", activeRoundIndex: 0 } as TournamentShowState}
        variant="admin"
      />
    );

    expect(screen.getByRole("heading", { name: /Runde 1.*Level 1/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Runde 2.*Level 2/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Runde 3.*Level 2/ })).toBeTruthy();
    const firstMatch = screen.getByRole("article", { name: "Match m1" });
    expect(within(firstMatch).getByText("Sieger")).toBeTruthy();
    expect(
      within(firstMatch)
        .getByText("m1 beta")
        .closest("li")
        ?.classList.contains("tournament-bracket__participant--eliminated")
    ).toBe(true);
    expect(screen.getByRole("article", { name: "Match m2" }).getAttribute("data-active")).toBe(
      "true"
    );
    expect(screen.getAllByText("Wartet auf Sieger").length).toBeGreaterThan(0);
    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows at most three rounds around the present focus", () => {
    const firstRound = Array.from({ length: 8 }, (_, index) => match(`m${index}`, "pending"));
    render(
      <TournamentBracket
        state={state(firstRound)}
        show={{ activeRoundIndex: 2, activeMatchId: null } as TournamentShowState}
        variant="present"
      />
    );

    expect(screen.queryByRole("heading", { name: /Runde 1/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /Runde 2/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Runde 4/ })).toBeTruthy();
  });
});
