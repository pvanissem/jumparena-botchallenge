import type { MatchDef } from "@arena/shared";
import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import type { RaceSceneInitData } from "../game/scenes/RaceScene";
import { MatchRunner } from "./MatchRunner";

vi.mock("../game/scenes/RaceScene", () => ({ RaceScene: class {} }));
vi.mock("./MatchBootScene", () => ({
  MATCH_ASSETS_READY: "match-assets-ready",
  MATCH_BOOT_SCENE_KEY: "match-boot",
}));

function racer(finished: boolean): RacerRuntimeState {
  return {
    x: 10,
    y: 20,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished,
    didNotFinish: !finished,
    coinsCollected: 2,
    fruitScore: finished ? 20 : 5,
    livesRemaining: 2,
    deaths: 1,
    timeElapsedMs: finished ? 1_000 : 2_000,
    lastCheckpoint: { x: 0, y: 0 },
    lastCheckpointId: null,
    reachedCheckpointIds: new Set<string>(),
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
  };
}

interface TestSlot {
  botId: string;
  name: string;
  color: string;
  viewport: { x: number; y: number; width: number; height: number };
  sceneKey: string;
  status: { racer: RacerRuntimeState; pausedReasonKind: null } | null;
  hadOutcome: boolean;
}

interface TestableRunner {
  slots: TestSlot[];
  checkFinished(): void;
  emitTilesIfChanged(): void;
}

describe("MatchRunner result handoff", () => {
  it("keeps individual outcomes and reports the final result immediately exactly once", () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();
    const onTilesChange = vi.fn();
    const runner = new MatchRunner(
      {} as Phaser.Game,
      vi.fn(),
      onFinished,
      onTilesChange
    ) as unknown as TestableRunner;
    runner.slots = [
      {
        botId: "winner",
        name: "Winner",
        color: "#00ffff",
        viewport: { x: 0, y: 0, width: 100, height: 100 },
        sceneKey: "winner",
        status: { racer: racer(true), pausedReasonKind: null },
        hadOutcome: false,
      },
      {
        botId: "runner-up",
        name: "Runner Up",
        color: "#ff00ff",
        viewport: { x: 100, y: 0, width: 100, height: 100 },
        sceneKey: "runner-up",
        status: null,
        hadOutcome: false,
      },
    ];

    runner.emitTilesIfChanged();
    expect(onTilesChange).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();

    runner.slots[1].status = { racer: racer(false), pausedReasonKind: null };
    runner.checkFinished();
    runner.checkFinished();

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0][0].entries[0].botId).toBe("winner");
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe("MatchRunner asset boot", () => {
  it("waits for the boot scene when Phaser has not registered it yet", () => {
    vi.useFakeTimers();
    let assetsReady: (() => void) | undefined;
    const addScene = vi.fn();
    const onTilesChange = vi.fn();
    const game = {
      canvas: { width: 960, height: 540 },
      events: {
        once: (_event: string, listener: () => void) => {
          assetsReady = listener;
        },
      },
      scene: {
        getScene: () => undefined,
        add: addScene,
        remove: vi.fn(),
      },
    } as unknown as Phaser.Game;
    const match: MatchDef = {
      id: "match-1",
      status: "running",
      result: null,
      participants: [
        { botId: "b1", name: "One", author: "A", color: "#111" },
        { botId: "b2", name: "Two", author: "B", color: "#222" },
      ],
    };
    const runner = new MatchRunner(game, vi.fn(), vi.fn(), onTilesChange);

    runner.start({
      match,
      levelId: "level-one",
      livesPerRun: 3,
      sourceById: new Map(),
    });

    expect(addScene).not.toHaveBeenCalled();
    assetsReady?.();
    expect(addScene).toHaveBeenCalledTimes(2);
    expect(addScene.mock.calls.map((call) => call[3].assetsPreloaded)).toEqual([true, true]);
    expect(onTilesChange).toHaveBeenCalledWith({
      winnerBotId: null,
      slots: [
        expect.objectContaining({ botId: "b1", name: "One", color: "#111" }),
        expect.objectContaining({ botId: "b2", name: "Two", color: "#222" }),
      ],
    });
    runner.stop();
    vi.useRealTimers();
  });
});

describe("MatchRunner skip", () => {
  afterEach(() => vi.useRealTimers());

  function setup(assetsReady = true) {
    vi.useFakeTimers();
    const listeners: Array<NonNullable<RaceSceneInitData["onStatusChange"]>> = [];
    let onAssetsReady: (() => void) | undefined;
    const shutdown = vi.fn();
    const remove = vi.fn();
    const add = vi.fn((_key, _scene, _start, data: RaceSceneInitData) => {
      if (!data.onStatusChange) throw new Error("Missing status callback");
      listeners.push(data.onStatusChange);
    });
    const game = {
      canvas: { width: 960, height: 540 },
      events: {
        once: (_event: string, listener: () => void) => {
          onAssetsReady = listener;
        },
      },
      scene: {
        getScene: (key: string) => (key === "match-boot" ? { assetsReady } : { shutdown }),
        add,
        remove,
      },
    } as unknown as Phaser.Game;
    const onFinished = vi.fn();
    const onProgress = vi.fn();
    const runner = new MatchRunner(game, onProgress, onFinished);
    runner.start({
      match: {
        id: "m1",
        participants: ["b1", "b2"].map((botId) => ({
          botId,
          name: botId,
          author: "A",
          color: "#111",
        })),
        status: "running",
        result: null,
      },
      levelId: "level-one",
      livesPerRun: 3,
      sourceById: new Map(),
    });
    const report = (index: number, state: RacerRuntimeState) =>
      listeners[index]({
        racer: state,
        pausedReasonKind: null,
      } as Parameters<NonNullable<RaceSceneInitData["onStatusChange"]>>[0]);
    return {
      runner,
      onFinished,
      onProgress,
      shutdown,
      remove,
      add,
      report,
      ready: () => onAssetsReady?.(),
    };
  }

  it("preserves goals and scores unfinished racers as DNF, then stops all scenes exactly once", () => {
    const test = setup();
    test.report(0, racer(true));
    test.report(1, { ...racer(false), didNotFinish: false, fruitScore: 100 });

    test.runner.skip();
    test.runner.skip();
    test.report(1, racer(true));
    test.runner.stop();

    expect(test.onFinished).toHaveBeenCalledTimes(1);
    expect(test.onFinished.mock.calls[0][0].entries).toEqual([
      expect.objectContaining({ botId: "b1", rank: 1, reachedGoal: true, fruitScore: 20 }),
      expect.objectContaining({
        botId: "b2",
        rank: 2,
        reachedGoal: false,
        score: 35,
        timeElapsedMs: 2000,
        deaths: 1,
        disabled: false,
      }),
    ]);
    expect(test.shutdown).toHaveBeenCalledTimes(2);
    expect(test.remove).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(test.onProgress).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "includes every participant without status data (assets ready: %s)",
    (ready) => {
      const test = setup(ready);
      test.runner.skip();
      test.ready();
      expect(test.onFinished).toHaveBeenCalledTimes(1);
      expect(test.onFinished.mock.calls[0][0].entries).toEqual([
        expect.objectContaining({
          botId: "b1",
          rank: 1,
          score: -50,
          deaths: 0,
          fruitScore: 0,
          reachedGoal: false,
          disabled: false,
        }),
        expect.objectContaining({
          botId: "b2",
          rank: 2,
          score: -50,
          deaths: 0,
          fruitScore: 0,
          reachedGoal: false,
          disabled: false,
        }),
      ]);
      expect(test.add).toHaveBeenCalledTimes(ready ? 2 : 0);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("does not report a second result after a natural finish or a stopped attempt", () => {
    const test = setup();
    test.report(0, racer(true));
    test.report(1, racer(false));
    test.runner.skip();
    expect(test.onFinished).toHaveBeenCalledTimes(1);
    test.runner.stop();

    const stopped = setup();
    stopped.runner.stop();
    stopped.runner.skip();
    expect(stopped.onFinished).not.toHaveBeenCalled();
  });
});
