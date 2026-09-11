import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { StationOverlay } from "./StationOverlay";
import { createStationState, PLAY_LEVEL_IDS, PLAY_LIVES, type StationState } from "./station";

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: false,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 40,
    livesRemaining: 4,
    deaths: 1,
    timeElapsedMs: 20_000,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

function state(overrides: Partial<StationState> = {}): StationState {
  return { ...createStationState(), ...overrides };
}

function renderOverlay(
  overrides: Partial<StationState> = {},
  liveRacer: RacerRuntimeState | null = null
) {
  render(<StationOverlay stationId="left" state={state(overrides)} racer={liveRacer} />);
}

describe("StationOverlay – Wartezustand (US-7)", () => {
  afterEach(cleanup);

  it("fordert zum Mitspielen auf", () => {
    renderOverlay();
    expect(screen.getByText(/taste drücken/i)).toBeTruthy();
  });

  it("zeigt im Wartezustand kein HUD", () => {
    renderOverlay();
    expect(screen.queryByTestId("station-hud")).toBeNull();
  });
});

describe("StationOverlay – Namenseingabe (US-2)", () => {
  afterEach(cleanup);

  it("zeigt acht Zeichenplätze", () => {
    renderOverlay({ phase: "name-entry" });
    expect(screen.getAllByTestId(/name-slot-/)).toHaveLength(8);
  });

  it("markiert die Cursorposition", () => {
    renderOverlay({
      phase: "name-entry",
      nameEntry: { chars: ["A", "B", "C", "D", "E", "F", "G", "H"], cursor: 2 },
    });
    expect(screen.getByTestId("name-slot-2").getAttribute("data-cursor")).toBe("true");
    expect(screen.getByTestId("name-slot-1").getAttribute("data-cursor")).toBe("false");
  });
});

describe("StationOverlay – HUD im Spiel (US-7)", () => {
  afterEach(cleanup);

  it("zeigt Name, Level und Gesamtscore", () => {
    renderOverlay({ phase: "playing", name: "MAX", levelIndex: 2, totalScore: 250 }, racer());
    const hud = screen.getByTestId("station-hud");
    expect(hud.textContent).toContain("MAX");
    expect(hud.textContent).toContain(`3/${PLAY_LEVEL_IDS.length}`);
    expect(hud.textContent).toContain("250");
  });

  it("zeigt die verbleibenden Leben als Herzen", () => {
    renderOverlay({ phase: "playing", livesRemaining: 3 }, racer({ livesRemaining: 3 }));
    expect(screen.getByTestId("station-lives").textContent).toBe("❤️❤️❤️");
  });

  it("nutzt die Leben aus dem laufenden Level, sobald verfügbar", () => {
    renderOverlay({ phase: "playing", livesRemaining: PLAY_LIVES }, racer({ livesRemaining: 2 }));
    expect(screen.getByTestId("station-lives").textContent).toBe("❤️❤️");
  });

  it("zeigt die Punkte des laufenden Levels", () => {
    renderOverlay({ phase: "playing" }, racer({ fruitScore: 40 }));
    expect(screen.getByTestId("station-level-score").textContent).toContain("40");
  });

  it("zeigt die verbleibende Zeit des Levels", () => {
    renderOverlay({ phase: "playing" }, racer({ timeElapsedMs: 60_000 }));
    expect(screen.getByTestId("station-time").textContent).toContain("30");
  });

  it("zeigt eine Tastenlegende", () => {
    renderOverlay({ phase: "playing" }, racer());
    expect(screen.getByTestId("station-legend")).toBeTruthy();
  });
});

describe("StationOverlay – weitere Phasen (US-4, US-7)", () => {
  afterEach(cleanup);

  it("zeigt vor dem Level Nummer und Namen", () => {
    renderOverlay({ phase: "countdown", levelIndex: 1 });
    const intro = screen.getByTestId("station-level-intro");
    expect(intro.textContent).toContain("Level 2");
  });

  it("zeigt nach dem Level das Zwischenergebnis", () => {
    renderOverlay({
      phase: "level-result",
      results: [
        {
          levelId: "level-one",
          score: 123,
          reachedGoal: true,
          fruitScore: 80,
          deaths: 1,
          timeElapsedMs: 30_000,
          livesRemaining: 4,
        },
      ],
    });
    expect(screen.getByTestId("station-level-result").textContent).toContain("123");
  });

  it("kennzeichnet ein nicht geschafftes Level", () => {
    renderOverlay({
      phase: "level-result",
      results: [
        {
          levelId: "level-one",
          score: -20,
          reachedGoal: false,
          fruitScore: 10,
          deaths: 2,
          timeElapsedMs: 90_000,
          livesRemaining: 3,
        },
      ],
    });
    expect(screen.getByTestId("station-level-result").textContent).toMatch(/zeit|nicht geschafft/i);
  });

  it("zeigt am Ende Gesamtscore und geschaffte Level", () => {
    renderOverlay({
      phase: "game-over",
      name: "ANNA",
      totalScore: 999,
      results: [
        {
          levelId: "level-one",
          score: 999,
          reachedGoal: true,
          fruitScore: 500,
          deaths: 0,
          timeElapsedMs: 20_000,
          livesRemaining: 5,
        },
      ],
    });
    const gameOver = screen.getByTestId("station-game-over");
    expect(gameOver.textContent).toContain("ANNA");
    expect(gameOver.textContent).toContain("999");
    expect(gameOver.textContent).toContain("1");
  });

  it("zeigt die Platzierung, wenn der Eintrag in die Bestenliste kam", () => {
    renderOverlay({ phase: "game-over", rank: 3 });
    expect(screen.getByTestId("station-game-over").textContent).toContain("3");
  });

  it("erklärt, wie ein neues Spiel gestartet wird", () => {
    renderOverlay({ phase: "game-over" });
    expect(screen.getByTestId("station-game-over").textContent).toMatch(/neues spiel|start/i);
  });

  it("weist auf einen getrennten Controller hin", () => {
    renderOverlay({ phase: "disconnected" }, racer());
    expect(screen.getByText(/controller.*getrennt/i)).toBeTruthy();
  });
});
