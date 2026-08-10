import type { TournamentState } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LEVEL_REGISTRY } from "../game/level/levelRegistry";
import { BracketView } from "./BracketView";

function tournamentState(overrides: Partial<TournamentState> = {}): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-one", "level-two"],
    livesPerRun: 3,
    groupSize: 4,
    rounds: [],
    status: "idle",
    championBotId: null,
    ...overrides,
  };
}

function match(overrides: Partial<import("@arena/shared").MatchDef> & { id: string }) {
  return {
    id: overrides.id,
    participants: [{ botId: "b1", name: "Bot 1", author: "A", color: "#000" }],
    status: overrides.status ?? "pending",
    result: overrides.result ?? null,
  };
}

describe("BracketView", () => {
  afterEach(() => {
    cleanup();
  });

  it("zeigt den Levelnamen je Runde", () => {
    render(
      <BracketView
        state={tournamentState({
          rounds: [[match({ id: "m1" })], [match({ id: "m2" })], [match({ id: "m3" })]],
        })}
      />
    );

    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Level 1"),
        expect.stringContaining("Level 2"),
      ])
    );
    const level2Label = LEVEL_REGISTRY.find((e) => e.id === "level-two")?.label ?? "level-two";
    expect(headings.filter((text) => text?.includes(level2Label))).toHaveLength(2);
  });

  it('kennzeichnet eine laufende Runde als "läuft"', () => {
    render(
      <BracketView
        state={tournamentState({
          rounds: [[match({ id: "m1", status: "running" })]],
        })}
      />
    );

    const headings = screen
      .getAllByRole("heading")
      .map((h) => h.textContent)
      .join(" ");
    expect(headings).toMatch(/läuft/);
  });

  it('kennzeichnet eine abgeschlossene Runde als "abgeschlossen"', () => {
    render(
      <BracketView
        state={tournamentState({
          rounds: [
            [
              match({
                id: "m1",
                status: "finished",
                result: { entries: [] },
              }),
            ],
          ],
        })}
      />
    );

    expect(screen.getByText(/abgeschlossen/i)).toBeTruthy();
  });

  it('kennzeichnet eine angefangene, aber nicht beendete Runde als "läuft"', () => {
    render(
      <BracketView
        state={tournamentState({
          rounds: [
            [
              match({
                id: "m1",
                status: "finished",
                result: { entries: [] },
              }),
              match({ id: "m2" }),
            ],
          ],
        })}
      />
    );

    expect(screen.getByText(/läuft/i)).toBeTruthy();
    expect(screen.queryByText(/abgeschlossen/i)).toBeNull();
  });

  it('kennzeichnet eine ausstehende Runde als "ausstehend"', () => {
    render(
      <BracketView
        state={tournamentState({
          rounds: [[match({ id: "m1" })], [match({ id: "m2" })]],
        })}
      />
    );

    expect(screen.getAllByText(/ausstehend/i)).toHaveLength(2);
  });
});
