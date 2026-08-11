import { describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import type { ViewportRect } from "./gridViewports";
import { computeTileOverlays, type TileOverlaySlot } from "./tileOverlays";

const viewport: ViewportRect = { x: 0, y: 0, width: 100, height: 100 };

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
    fruitScore: 10,
    livesRemaining: 2,
    deaths: 0,
    timeElapsedMs: 1000,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

function slot(overrides: Partial<TileOverlaySlot> = {}): TileOverlaySlot {
  return {
    botId: "bot-a",
    name: "Bot A",
    color: "#00ffff",
    viewport,
    racer: racer(),
    pausedReasonKind: null,
    ...overrides,
  };
}

describe("computeTileOverlays", () => {
  it("includes running racers for a persistent name label", () => {
    const result = computeTileOverlays({
      slots: [slot()],
      winnerBotId: null,
    });

    expect(result).toEqual([
      expect.objectContaining({
        botId: "bot-a",
        name: "Bot A",
        color: "#00ffff",
        playerNumber: 1,
        outcome: null,
      }),
    ]);
  });

  it("includes a finished racer with 'goal' outcome", () => {
    const result = computeTileOverlays({
      slots: [slot({ racer: racer({ finished: true }) })],
      winnerBotId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].outcome?.kind).toBe("goal");
    expect(result[0].isWinner).toBe(false);
  });

  it("passes through name, viewport and racer", () => {
    const result = computeTileOverlays({
      slots: [
        slot({
          botId: "bot-a",
          name: "Alpha",
          viewport: { x: 10, y: 20, width: 30, height: 40 },
          racer: racer({ finished: true, fruitScore: 42 }),
        }),
      ],
      winnerBotId: null,
    });

    expect(result[0].botId).toBe("bot-a");
    expect(result[0].name).toBe("Alpha");
    expect(result[0].viewport).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(result[0].racer?.fruitScore).toBe(42);
  });

  it("keeps the name label before the first racer state arrives", () => {
    const result = computeTileOverlays({
      slots: [slot({ racer: null })],
      winnerBotId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].racer).toBeNull();
    expect(result[0].outcome).toBeNull();
  });

  it("marks the winner only when winnerBotId is set", () => {
    const finished = racer({ finished: true });
    const resultNoWinner = computeTileOverlays({
      slots: [slot({ botId: "bot-a", racer: finished })],
      winnerBotId: null,
    });

    expect(resultNoWinner[0].isWinner).toBe(false);

    const resultWithWinner = computeTileOverlays({
      slots: [
        slot({ botId: "bot-a", racer: finished }),
        slot({ botId: "bot-b", racer: racer({ didNotFinish: true, livesRemaining: 0 }) }),
      ],
      winnerBotId: "bot-a",
    });

    expect(resultWithWinner.find((d) => d.botId === "bot-a")?.isWinner).toBe(true);
    expect(resultWithWinner.find((d) => d.botId === "bot-b")?.isWinner).toBe(false);
  });
});
