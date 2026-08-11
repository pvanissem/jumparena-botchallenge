import type { MatchDef, TournamentShowState } from "@arena/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShowControlPanel } from "./ShowControlPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const match: MatchDef = {
  id: "m1",
  participants: [
    { botId: "b1", name: "Alpha", author: "Ada", color: "#0ff" },
    { botId: "b2", name: "Beta", author: "Bob", color: "#f0f" },
  ],
  status: "pending",
  result: null,
};

function show(phase: TournamentShowState["phase"]): TournamentShowState {
  return {
    phase,
    activeMatchId: phase === "ready" ? null : "m1",
    activeRoundIndex: phase === "ready" ? null : 0,
    matchAttemptId: null,
    executorClientId: null,
    phaseEndsAtMs: phase === "ready" || phase === "match-running" ? null : 10_000,
    heldRemainingMs: null,
    holds: [],
    presentReady: true,
  };
}

describe("ShowControlPanel", () => {
  it("starts a ready show", () => {
    const onControl = vi.fn();
    render(
      <ShowControlPanel
        show={show("ready")}
        match={null}
        remainingSeconds={null}
        onControl={onControl}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show starten" }));
    expect(onControl).toHaveBeenCalledWith("start");
  });

  it("shows match, remaining time and timed-phase actions", () => {
    const onControl = vi.fn();
    render(
      <ShowControlPanel
        show={show("countdown")}
        match={match}
        remainingSeconds={3}
        onControl={onControl}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText(/Alpha/)).toBeTruthy();
    expect(screen.getByText(/Beta/)).toBeTruthy();
    expect(screen.getByText("3s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Sofort weiter" }));
    expect(onControl).toHaveBeenNthCalledWith(1, "pause");
    expect(onControl).toHaveBeenNthCalledWith(2, "advance");
  });

  it("offers resume while operator-held and explains a missing present", () => {
    const onControl = vi.fn();
    const held = {
      ...show("matchup-intro"),
      holds: ["operator", "present-unavailable"],
      presentReady: false,
      phaseEndsAtMs: null,
      heldRemainingMs: 4_000,
    } satisfies TournamentShowState;
    render(
      <ShowControlPanel
        show={held}
        match={match}
        remainingSeconds={null}
        onControl={onControl}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText(/Present-Ansicht/)).toBeTruthy();
    expect(screen.getByText("4s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fortsetzen" }));
    expect(onControl).toHaveBeenCalledWith("resume");
  });

  it("does not offer pause or advance while a match is running", () => {
    render(
      <ShowControlPanel
        show={show("match-running")}
        match={{ ...match, status: "running" }}
        remainingSeconds={null}
        onControl={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sofort weiter" })).toBeNull();
  });

  it("requires confirmation before reset", () => {
    const onReset = vi.fn();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(
      <ShowControlPanel
        show={show("ready")}
        match={null}
        remainingSeconds={null}
        onControl={vi.fn()}
        onReset={onReset}
      />
    );

    const reset = screen.getByRole("button", { name: "Turnier zurücksetzen" });
    fireEvent.click(reset);
    fireEvent.click(reset);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
