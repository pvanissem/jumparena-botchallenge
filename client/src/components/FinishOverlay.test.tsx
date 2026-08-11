import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { FinishOverlay } from "./FinishOverlay";

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
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

describe("FinishOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the win title when the goal was reached", () => {
    render(<FinishOverlay racer={racer()} onRestart={vi.fn()} />);
    expect(screen.getByText(/ziel erreicht/i)).toBeTruthy();
  });

  it("shows the fail title on DNF", () => {
    render(
      <FinishOverlay racer={racer({ finished: false, didNotFinish: true })} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/nicht ins ziel/i)).toBeTruthy();
  });

  it("renders the score, breakdown and restart button", () => {
    const onRestart = vi.fn();
    render(<FinishOverlay racer={racer()} onRestart={onRestart} />);

    expect(screen.getByText(/punkte/i)).toBeTruthy();
    expect(screen.getByText(/früchte/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /neu starten/i })).toBeTruthy();
  });

  it("calls onRestart when the restart button is clicked", () => {
    const onRestart = vi.fn();
    render(<FinishOverlay racer={racer()} onRestart={onRestart} />);

    fireEvent.click(screen.getByRole("button", { name: /neu starten/i }));
    expect(onRestart).toHaveBeenCalled();
  });
});
