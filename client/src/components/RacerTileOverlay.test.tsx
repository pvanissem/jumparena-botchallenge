import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import type { TileOverlayDescriptor } from "../match/tileOverlays";
import { RacerTileOverlay } from "./RacerTileOverlay";

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: true,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 50,
    livesRemaining: 2,
    deaths: 0,
    timeElapsedMs: 12_345,
    lastCheckpoint: { x: 0, y: 0 },
    lastCheckpointId: null,
    reachedCheckpointIds: new Set<string>(),
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

function descriptor(
  outcomeKind: NonNullable<TileOverlayDescriptor["outcome"]>["kind"],
  isWinner: boolean
): TileOverlayDescriptor {
  return {
    botId: "bot-a",
    name: "Alpha",
    color: "#00ffff",
    playerNumber: 1,
    viewport: { x: 0, y: 0, width: 100, height: 100 },
    outcome: { kind: outcomeKind, reachedGoal: outcomeKind === "goal" },
    racer: racer({
      finished: outcomeKind === "goal",
      didNotFinish: outcomeKind !== "goal",
    }),
    isWinner,
  };
}

describe("RacerTileOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ["goal" as const, /ziel erreicht/i],
    ["out-of-lives" as const, /leben verbraucht/i],
    ["time-limit" as const, /zeit abgelaufen/i],
    ["disabled" as const, /bot pausiert/i],
  ])("renders the %s title and class", (kind, titlePattern) => {
    const { container } = render(<RacerTileOverlay descriptor={descriptor(kind, false)} />);
    expect(screen.getByText(titlePattern)).toBeTruthy();
    const card = container.querySelector(".pixel-overlay__card");
    expect(card?.classList.contains("pixel-overlay__card--winner")).toBe(false);
  });

  it("displays bot name and score", () => {
    render(<RacerTileOverlay descriptor={descriptor("goal", false)} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText(/punkte/i)).toBeTruthy();
  });

  it("renders a persistent player label before an outcome", () => {
    const running = {
      ...descriptor("goal", false),
      racer: null,
      outcome: null,
    };

    const { container } = render(<RacerTileOverlay descriptor={running} />);
    expect(screen.getByText("Player 1")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(document.querySelector(".racer-tile-label")).toBeTruthy();
    expect(document.querySelector(".pixel-overlay__card")).toBeNull();
    expect(container.querySelector(".pixel-overlay--running")).toBeTruthy();
  });

  it("shows the winner badge and border only when isWinner is true", () => {
    const { container: notWinner } = render(
      <RacerTileOverlay descriptor={descriptor("goal", false)} />
    );
    expect(notWinner.querySelector(".pixel-overlay__winner-badge")).toBeNull();
    expect(
      notWinner
        .querySelector(".pixel-overlay__card")
        ?.classList.contains("pixel-overlay__card--winner")
    ).toBe(false);

    cleanup();

    const { container: winner } = render(
      <RacerTileOverlay descriptor={descriptor("goal", true)} />
    );
    expect(winner.querySelector(".pixel-overlay__winner-badge")).not.toBeNull();
    expect(
      winner
        .querySelector(".pixel-overlay__card")
        ?.classList.contains("pixel-overlay__card--winner")
    ).toBe(true);
  });

  it("does not contain a restart button", () => {
    render(<RacerTileOverlay descriptor={descriptor("goal", false)} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
