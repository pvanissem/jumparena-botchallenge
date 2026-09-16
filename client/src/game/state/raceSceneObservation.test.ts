import type { Action, BotState } from "@arena/bot-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BotRunner } from "../../sandbox/BotRunner";
import { createBrowserWorker } from "../../sandbox/createBrowserWorker";
import { FakeWorker } from "../../sandbox/testUtils/FakeWorker";
import { KeyboardController } from "../control/KeyboardController";
import { tileTypeAt } from "../level/tiles";
import type { LevelDef } from "../level/types";
import { MOVEMENT_TUNING, rampedSprintSpeed } from "../movement/movement";
import { createInitialRacerState } from "../rules/racerState";
import type { WorldSnapshot } from "./worldSnapshot";

vi.mock("phaser", () => ({
  default: { Scene: class {}, Animations: { Events: { ANIMATION_COMPLETE: "complete" } } },
}));
vi.mock("../../sandbox/createBrowserWorker", () => ({ createBrowserWorker: vi.fn() }));

import { RaceScene, type RaceSceneInitData } from "../scenes/RaceScene";
import raceSceneSource from "../scenes/RaceScene?raw";

const level: LevelDef = {
  worldWidth: 2000,
  worldHeight: 540,
  groundY: 460,
  spawn: { x: 80, y: 440 },
  goal: { x: 1800, y: 460 },
  platforms: [{ x: 0, y: 460, tilesWide: 30 }],
  coins: [],
  checkpoints: [],
  utilities: [],
  hiddenCoinBlocks: [{ id: "block", x: 160, y: 350, fruit: "kiwi" }],
  hazards: [
    { id: "patrol", kind: "ninjafrog", x: 40, y: 440, minX: 40, maxX: 400, speed: 80 },
    { id: "pendulum", kind: "kugelblitz", pivotX: 300, pivotY: 100, length: 100 },
    {
      id: "head",
      kind: "spikehead",
      x: 350,
      originY: 80,
      fallToY: 440,
      triggerMinX: 300,
      triggerMaxX: 400,
    },
  ],
};

function sprite(id: string, x: number, y: number, kind = "ninjafrog") {
  return {
    x,
    y,
    active: true,
    body: {
      x: x - 10,
      y: y - 12,
      width: 20,
      height: 24,
      enable: true,
      checkCollision: { none: false },
    },
    getData: (key: string) => ({ id, kind, fruit: "kiwi" })[key],
    play: vi.fn(),
    once: vi.fn(),
    destroy: vi.fn(),
    setFlipX: vi.fn(),
  };
}

// Lifecycle/wiring unit test, deliberately not a Phaser physics proof.
function fixture() {
  const scene = new RaceScene();
  const body = {
    x: 68,
    y: 424,
    width: 28.8,
    height: 38.4,
    velocity: { x: 80, y: 0 },
    blocked: { down: true },
    touching: { down: false },
    setVelocityX(x: number) {
      this.velocity.x = x;
    },
    setVelocityY(y: number) {
      this.velocity.y = y;
    },
    setVelocity(x: number, y: number) {
      this.velocity = { x, y };
    },
    setAcceleration: vi.fn(),
    setAllowGravity: vi.fn(),
  };
  const hazards = level.hazards.map((def, i) => ({
    def,
    sprite: sprite(def.id, 200 + i * 48, 400 - i * 80, def.kind),
  }));
  const coins = [sprite("block", 160, 322)];
  const internals = scene as unknown as {
    buildSnapshot(): WorldSnapshot;
    fireBotTick(): void;
    markDamageAndRespawn(): void;
    onHazardOverlap(hazard: unknown): void;
    onUtilityOverlap(utility: unknown): void;
    applyMovement(dir: -1 | 0 | 1, sprint: boolean, jump: boolean): void;
    observeAndAct(time: number, delta: number): void;
    preparePhysics(time: number, delta: number): void;
    createController(): typeof internals.controller;
    notifyStatus(): void;
    pendingDecision: Promise<void> | null;
    lastBotActions: Action[];
    sprintHoldMs: number;
    sprintDirection: -1 | 0 | 1;
    jumpStartMs: number | null;
    elapsedMs: number;
    sinceLastBotTick: number;
    currentDelta: number;
    initData: RaceSceneInitData;
    frameCounter: number;
    controller: {
      getNextActions(input: { botState: BotState }): Promise<Action[]>;
      dispose(): void;
    };
    botRunner: BotRunner | null;
    racer: ReturnType<typeof createInitialRacerState>;
  };
  const onStatusChange = vi.fn<NonNullable<RaceSceneInitData["onStatusChange"]>>();
  Object.assign(scene, {
    level,
    racer: createInitialRacerState(level),
    player: { x: 82, y: 440, body, setPosition: vi.fn(), play: vi.fn() },
    world: {
      hazardInstances: hazards,
      coins: { getChildren: () => coins },
      blocks: { getChildren: () => [sprite("block", 160, 350)] },
      utilityInstances: [],
      goal: sprite("goal", 1800, 428),
    },
    initData: { controllerMode: "bot", levelId: "fixture", onStatusChange },
    audioEnabled: false,
    currentDelta: 16,
    elapsedMs: 100,
    controller: { getNextActions: vi.fn().mockResolvedValue([]), dispose: vi.fn() },
    updatePlayerAnimation: vi.fn(),
    updateSpikeheadTriggers: vi.fn(),
    physics: {
      world: {
        fps: 60,
        isPaused: false,
        pause() {
          this.isPaused = true;
        },
        resume() {
          this.isPaused = false;
        },
      },
    },
    events: { off: vi.fn() },
    cameras: { main: { stopFollow: vi.fn() } },
    dimRacerSprite: vi.fn(),
  });
  return { scene, s: internals, body, hazards, coins, onStatusChange };
}

describe("RaceScene production boundary", () => {
  it("has no test-platform configuration, getters or worker metadata", () => {
    expect(raceSceneSource).not.toMatch(
      /\b(?:botTest|workerTimeoutMs|onObservation|levelFixture|RaceSceneBotTestStatus|whenBotReady|waitForPendingDecision|getBotTestStatus|toolsApiVersion)\b/
    );
  });
});

describe("RaceScene live observation", () => {
  it("reads patrol, pendulum and spikehead sprites and collider bounds, not definitions", () => {
    const { s, hazards } = fixture();
    const snapshot = s.buildSnapshot();
    expect(snapshot.hazards.map((h) => [h.x, h.y])).toEqual(
      hazards.map((h) => [h.sprite.x, h.sprite.y])
    );
    expect(snapshot.hazards[0]).toMatchObject({
      bounds: { x: 190, y: 388, width: 20, height: 24 },
      vx: 0,
      vy: 0,
    });
  });

  it("measures velocity once per observation, never in a collision callback, and resets on respawn", () => {
    const { s, hazards } = fixture();
    s.buildSnapshot();
    s.elapsedMs = 120;
    hazards[0].sprite.x += 2;
    // Inactive contact must be a pure activity read.
    hazards[0].sprite.body.checkCollision.none = true;
    s.onHazardOverlap(hazards[0].sprite);
    expect(s.racer.livesRemaining).toBe(3);
    hazards[0].sprite.x += 8;
    s.elapsedMs = 200;
    expect(s.buildSnapshot().hazards[0].vx).toBe(100);
    s.markDamageAndRespawn();
    hazards[0].sprite.x += 300;
    s.elapsedMs = 300;
    expect(s.buildSnapshot().hazards[0].vx).toBe(0);
  });

  it("includes live block fruit and removes collected/disabled fruit and destroyed hazards from lists and tiles", () => {
    const { s, coins, hazards } = fixture();
    s.racer = { ...s.racer, resolvedBlockIds: new Set(["block"]) };
    let snapshot = s.buildSnapshot();
    expect(snapshot.visibleCoins).toEqual([
      expect.objectContaining({ id: "block", x: 160, y: 322, value: 15 }),
    ]);
    expect(tileTypeAt(level, 10, 21, snapshot.dynamic)).toBe("solid");
    expect(tileTypeAt(level, 12, 25, snapshot.dynamic)).toBe("hazard");
    expect(tileTypeAt(level, 2, 27, snapshot.dynamic)).not.toBe("hazard");
    coins[0].active = false;
    hazards[0].sprite.active = false;
    snapshot = s.buildSnapshot();
    expect(snapshot.visibleCoins).toEqual([]);
    expect(snapshot.hazards.some((h) => h.id === "patrol")).toBe(false);
    expect(tileTypeAt(level, 12, 25, snapshot.dynamic)).not.toBe("hazard");
  });

  it("keeps resolved block bounds until the body is removed and omits collected active fruit", async () => {
    const { scene, s, coins } = fixture();
    s.racer = {
      ...s.racer,
      resolvedBlockIds: new Set(["block"]),
      collectedCoinIds: new Set(["block"]),
    };
    expect(coins[0].active).toBe(true);
    expect(s.buildSnapshot().visibleCoins).toEqual([]);
    s.fireBotTick();
    await s.pendingDecision;
    const state = vi.mocked(s.controller.getNextActions).mock.calls[0][0].botState;
    expect(state.platforms).toContainEqual(
      expect.objectContaining({ id: "block", collision: "solid", width: 20, height: 24 })
    );
    const world = (scene as unknown as { world: { blocks: { getChildren(): unknown[] } } }).world;
    world.blocks.getChildren = () => [];
    s.fireBotTick();
    await s.pendingDecision;
    const next = vi.mocked(s.controller.getNextActions).mock.calls[1][0].botState;
    expect(next.platforms.some((p) => p.id === "block")).toBe(false);
    expect(tileTypeAt(level, 10, 21, s.buildSnapshot().dynamic)).toBe("empty");
  });

  it("starts velocity measurement anew at a nonpositive interval", () => {
    const { s, hazards } = fixture();
    s.buildSnapshot();
    hazards[0].sprite.x += 50;
    expect(s.buildSnapshot().hazards[0].vx).toBe(0);
    s.elapsedMs += 100;
    hazards[0].sprite.x += 10;
    expect(s.buildSnapshot().hazards[0].vx).toBe(100);
  });

  it("synchronizes position/ground before observing and exposes scaled world body", async () => {
    const { s, body } = fixture();
    s.sinceLastBotTick = 33;
    body.blocked.down = false;
    s.observeAndAct(100, 16);
    await s.pendingDecision;
    const state = vi.mocked(s.controller.getNextActions).mock.calls[0][0].botState;
    expect(state.position).toEqual({ x: 82, y: 440 });
    expect(state.onGround).toBe(false);
    expect(state.velocity).toEqual({ vx: 80, vy: 0 });
    expect(state.tuning).toMatchObject({ botWidth: 28.8, botHeight: 38.4 });
    expect(state).toMatchObject({
      navigation: { version: 1, body: { x: 68, y: 424, width: 28.8, height: 38.4 } },
    });
  });
});

describe("RaceScene worker lifecycle (unit wiring only)", () => {
  afterEach(() => vi.useRealTimers());

  function start() {
    const f = fixture();
    const worker = new FakeWorker();
    vi.mocked(createBrowserWorker).mockReturnValue(worker);
    f.s.initData = {
      controllerMode: "bot",
      botSourceCode: "export default { apiVersion: 1, decide() { return []; } };",
      onStatusChange: f.onStatusChange,
    };
    f.s.elapsedMs = 0;
    f.s.controller = f.s.createController();
    return { ...f, worker };
  }

  it("uses the regular 5 ms worker budget and emits only normal status fields", async () => {
    vi.useFakeTimers();
    const { s, worker, onStatusChange } = start();
    worker.emit({ type: "module-ready" });
    await s.botRunner?.whenReady();
    s.racer = {
      ...s.racer,
      deaths: 2,
      fruitScore: 25,
      coinsCollected: 3,
      livesRemaining: 1,
      x: 123,
    };
    s.notifyStatus();
    expect(onStatusChange).toHaveBeenLastCalledWith({
      racer: s.racer,
      pausedReason: null,
      pausedReasonKind: null,
      lastRuntimeError: null,
      consecutiveFailureCount: 0,
    });
    s.fireBotTick();
    await vi.advanceTimersByTimeAsync(4);
    expect(s.botRunner?.consecutiveFailureCount).toBe(0);
    expect(s.pendingDecision).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await s.pendingDecision;
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ consecutiveFailureCount: 1 })
    );
    expect(s.pendingDecision).toBeNull();
    s.controller.dispose();
  });

  it("freezes physics, time, frames, hazards and observations until module-ready", async () => {
    const { scene, s, worker, hazards, body } = start();
    expect(scene.physics.world.isPaused).toBe(true);
    const x = hazards[0].sprite.x;
    for (let i = 0; i < 4; i++) {
      s.preparePhysics(i * 33, 33);
      s.observeAndAct(i * 33, 33);
    }
    expect(s.elapsedMs).toBe(0);
    expect(s.frameCounter).toBe(0);
    expect(hazards[0].sprite.x).toBe(x);
    expect(body.velocity.x).toBe(80);
    expect(worker.sentMessages.filter((m) => m.type === "tick")).toHaveLength(0);
    worker.emit({ type: "module-ready" });
    expect(await s.botRunner?.whenReady()).toBe(true);
    expect(worker.sentMessages.filter((m) => m.type === "tick")).toHaveLength(0);
    s.preparePhysics(1000, 1000 / 60);
    expect(scene.physics.world.isPaused).toBe(false);
    expect(s.elapsedMs).toBe(1000 / 60);
    expect(s.frameCounter).toBe(1);
    s.controller.dispose();
  });

  it("keeps failed initialization frozen and reports its actual reason", async () => {
    const { scene, s, worker, onStatusChange } = start();
    worker.emit({ type: "module-invalid", reason: "invalid fixture bot" });
    expect(await s.botRunner?.whenReady()).toBe(false);
    s.preparePhysics(500, 500);
    s.observeAndAct(500, 500);
    expect(s.elapsedMs).toBe(0);
    expect(scene.physics.world.isPaused).toBe(true);
    s.notifyStatus();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pausedReasonKind: "invalid-module",
        pausedReason: "ungültiges Bot-Modul: invalid fixture bot",
      })
    );
  });

  it("submits the observed state once, not pending or paused ticks", async () => {
    const { s, worker } = start();
    worker.emit({ type: "module-ready" });
    await s.botRunner?.whenReady();
    s.fireBotTick();
    const ticks = worker.sentMessages.filter((m) => m.type === "tick");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]).toMatchObject({
      stateTick: 0,
      epoch: 0,
      state: { tick: 0, position: { x: 82, y: 440 }, navigation: { epoch: 0 } },
    });
    s.fireBotTick();
    expect(worker.sentMessages.filter((m) => m.type === "tick")).toHaveLength(1);
    s.controller.dispose();
    await s.pendingDecision;
    s.fireBotTick();
    expect(worker.sentMessages.filter((m) => m.type === "tick")).toHaveLength(1);
  });

  it("reports synchronous worker dispatch failure and clears the pending decision", async () => {
    const { s, worker, onStatusChange } = start();
    worker.emit({ type: "module-ready" });
    await s.botRunner?.whenReady();
    worker.postMessage.mockImplementationOnce(() => {
      throw new Error("dispatch failed");
    });
    s.fireBotTick();
    await s.pendingDecision;
    expect(s.pendingDecision).toBeNull();
    expect(s.lastBotActions).toEqual([]);
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pausedReasonKind: "worker-error",
        pausedReason: "Error: dispatch failed",
      })
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("ends at exactly 90000 ms after 5400 fixed frames and never advances terminal physics/time", async () => {
    const { scene, s, onStatusChange } = fixture();
    s.elapsedMs = 0;
    for (let frame = 1; frame <= 5399; frame++) {
      s.preparePhysics((frame * 1000) / 60, 1000 / 60);
      s.observeAndAct((frame * 1000) / 60, 1000 / 60);
      await s.pendingDecision;
    }
    expect(s.racer.didNotFinish).toBe(false);
    s.preparePhysics(90000, 1000 / 60);
    s.observeAndAct(90000, 1000 / 60);
    expect(s.racer.timeElapsedMs).toBe(90000);
    expect(s.racer.didNotFinish).toBe(true);
    expect(scene.physics.world.isPaused).toBe(true);
    s.preparePhysics(100000, 10000);
    s.observeAndAct(100000, 10000);
    expect(s.elapsedMs).toBe(90000);
    expect(s.frameCounter).toBe(5400);
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pausedReason: null })
    );
  });

  it("clamps a final oversized delta and does not report normal disposal as bot failure", async () => {
    const { s, worker, onStatusChange } = start();
    worker.emit({ type: "module-ready" });
    await s.botRunner?.whenReady();
    s.elapsedMs = 89999;
    s.preparePhysics(90020, 21);
    s.observeAndAct(90020, 21);
    expect(s.botRunner?.pausedReasonKind).toBe("disposed");
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        racer: expect.objectContaining({ timeElapsedMs: 90000, didNotFinish: true }),
        pausedReason: null,
        pausedReasonKind: null,
      })
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it.each([-0.0000001, 0.0000001])(
    "clamps the time limit with accumulated rounding drift %s",
    (drift) => {
      const { s } = fixture();
      s.elapsedMs = 90000 - 1000 / 60 + drift;
      s.preparePhysics(90000, 1000 / 60);
      s.observeAndAct(90000, 1000 / 60);
      expect(s.racer.timeElapsedMs).toBe(90000);
      expect(s.racer.didNotFinish).toBe(true);
    }
  );

  it("does not resume a shutdown scene when an already-resolved ready promise completes late", async () => {
    const { scene, s, worker } = start();
    worker.emit({ type: "module-ready" });
    scene.shutdown();
    await s.botRunner?.whenReady();
    s.preparePhysics(100, 100);
    s.observeAndAct(100, 100);
    expect(s.elapsedMs).toBe(0);
    expect(s.frameCounter).toBe(0);
    expect(scene.physics.world.isPaused).toBe(true);
  });

  it("reports the final post-physics position when the goal callback ended the racer", () => {
    const { s, onStatusChange } = fixture();
    s.racer = { ...s.racer, finished: true, x: 10 };
    s.observeAndAct(100, 16);
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ racer: expect.objectContaining({ finished: true, x: 82, y: 440 }) })
    );
  });
});

describe("RaceScene decision lifecycle", () => {
  it("allows one pending decision, rejects stale respawn actions and keeps scene ticks monotone", async () => {
    const { s } = fixture();
    let resolve!: (actions: Action[]) => void;
    vi.mocked(s.controller.getNextActions).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    s.fireBotTick();
    s.fireBotTick();
    expect(s.controller.getNextActions).toHaveBeenCalledTimes(1);
    const pending = s.pendingDecision;
    s.markDamageAndRespawn();
    resolve(["sprint-right"]);
    await pending;
    expect(s.lastBotActions).toEqual([]);
    s.fireBotTick();
    await s.pendingDecision;
    const states = vi
      .mocked(s.controller.getNextActions)
      .mock.calls.map((call) => call[0].botState);
    expect(states.map((state) => state.tick)).toEqual([0, 1]);
    expect(states[1]).toMatchObject({ justRespawned: true, navigation: { epoch: 1 } });
  });

  it("retains interval remainder without burst decisions on the same frame", async () => {
    const { s } = fixture();
    s.observeAndAct(100, 100);
    await s.pendingDecision;
    expect(s.controller.getNextActions).toHaveBeenCalledTimes(1);
    expect(s.sinceLastBotTick).toBe(1);
  });

  it.each(["mode", "shutdown"])(
    "invalidates %s answers and resets velocity history without resetting scene ticks",
    async (reason) => {
      const { scene, s, hazards } = fixture();
      let resolve!: (actions: Action[]) => void;
      vi.mocked(s.controller.getNextActions).mockReturnValueOnce(
        new Promise((r) => {
          resolve = r;
        })
      );
      s.fireBotTick();
      const pending = s.pendingDecision;
      if (reason === "mode") {
        Object.assign(s, {
          createController: () => ({
            getNextActions: vi.fn().mockResolvedValue([]),
            dispose: vi.fn(),
          }),
        });
        scene.setControllerMode("keyboard");
      } else scene.shutdown();
      resolve(["left"]);
      await pending;
      expect(s.lastBotActions).toEqual([]);
      hazards[0].sprite.x += 100;
      s.elapsedMs += 100;
      expect(s.buildSnapshot().hazards[0].vx).toBe(0);
      if (reason === "mode") {
        s.fireBotTick();
        await s.pendingDecision;
        expect(vi.mocked(s.controller.getNextActions).mock.calls[0][0].botState.tick).toBe(1);
      }
    }
  );

  it("records actions only when applied, with original state frame even after delayed response", async () => {
    const { s } = fixture();
    const recordEvent = vi.fn();
    Object.assign(s, {
      telemetry: { current: { recordState: vi.fn(), recordEvent }, advance: vi.fn() },
    });
    let resolve!: (actions: Action[]) => void;
    vi.mocked(s.controller.getNextActions).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    s.fireBotTick();
    s.preparePhysics(116, 16);
    resolve(["right", "left", "jump"]);
    await s.pendingDecision;
    expect(recordEvent).not.toHaveBeenCalled();
    s.sinceLastBotTick = 33;
    s.observeAndAct(116, 16);
    expect(recordEvent).not.toHaveBeenCalled();
    s.preparePhysics(132, 16);
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "action-applied",
        tick: 0,
        details: {
          stateTick: 0,
          stateFrame: 0,
          appliedFrame: 2,
          epoch: 0,
          actions: '["left","jump"]',
        },
      })
    );
    await s.pendingDecision;
  });

  it("uses scene ticks for runner diagnostics after controller replacement and suppresses stale diagnostics", async () => {
    const { s } = fixture();
    const recordDecision = vi.fn();
    const worker = new FakeWorker();
    vi.mocked(createBrowserWorker).mockReturnValue(worker);
    // Scene tick 0 happened before this runner existed.
    s.fireBotTick();
    await s.pendingDecision;
    Object.assign(s, {
      initData: {
        controllerMode: "bot",
        botSourceCode:
          'export default {apiVersion: 1, name: "test", author: "test", decide() { return []; }}',
      },
      telemetry: {
        current: { recordState: vi.fn(), recordDecision, recordEvent: vi.fn() },
        finish: vi.fn(),
      },
    });
    s.controller = s.createController();
    s.fireBotTick();
    expect(worker.sentMessages.filter((m) => m.type === "tick")).toHaveLength(0);
    worker.emit({ type: "module-ready", name: "test", author: "test" });
    await s.botRunner?.whenReady();
    s.fireBotTick();
    const request = worker.sentMessages.find((m) => m.type === "tick");
    if (request?.type !== "tick") throw new Error("missing tick");
    worker.emit({
      type: "action",
      tick: request.tick,
      stateTick: request.stateTick,
      epoch: request.epoch,
      actions: ["right"],
    });
    await s.pendingDecision;
    expect(recordDecision).toHaveBeenCalledWith(expect.objectContaining({ tick: 1 }));
    recordDecision.mockClear();
    s.fireBotTick();
    s.markDamageAndRespawn();
    worker.emit({ type: "action", tick: 1, stateTick: 2, epoch: 0, actions: ["left"] });
    await s.pendingDecision;
    expect(recordDecision).not.toHaveBeenCalled();
    s.controller.dispose();
  });
});

describe("Scene input/physics scheduling (mock world, not a physics proof)", () => {
  it.each(["fixed", "live"])(
    "%s applies an async edge jump before the very next world update",
    async (mode) => {
      const { s, body } = fixture();
      const dt = 1000 / 60;
      body.x = 176;
      body.velocity.x = 320;
      s.sprintHoldMs = 450;
      s.sprintDirection = 1;
      s.lastBotActions = ["sprint-right"];
      s.sinceLastBotTick = 33;
      let resolve!: (actions: Action[]) => void;
      const response = new Promise<Action[]>((r) => {
        resolve = r;
      });
      vi.mocked(s.controller.getNextActions).mockReturnValueOnce(response);
      s.observeAndAct(100, dt);
      expect(s.sprintHoldMs).toBe(450);
      resolve(["sprint-right", "jump"]);
      if (mode === "fixed") await s.pendingDecision;
      else {
        await response;
        await Promise.resolve();
      }
      // Resolving a worker promise must not mutate velocity or integrate time.
      expect(body.velocity.y).toBe(0);
      expect(s.sprintHoldMs).toBe(450);
      s.preparePhysics(100 + dt, dt);
      const worldUpdate = vi.fn(() => {
        // At vx=320, another step without jump loses support at x=180;
        // the next floor starts at x=276. Assert the input at the engine boundary.
        expect(body.x).toBe(176);
        expect(body.velocity.y).toBe(MOVEMENT_TUNING.SPRINT_JUMP_VELOCITY);
        body.x += (body.velocity.x * dt) / 1000;
        body.blocked.down = false;
      });
      worldUpdate();
      expect(body.x).toBeGreaterThan(180);
      expect(body.x).toBeLessThan(276);
      expect(s.jumpStartMs).toBe(100);
      expect(s.sprintHoldMs).toBeCloseTo(450 + dt);
      s.observeAndAct(100 + dt, dt);
      expect(s.sprintHoldMs).toBeCloseTo(450 + dt);
      await s.pendingDecision;
    }
  );

  it("integrates sprint once before physics, and observes that same applied ramp", async () => {
    const { s, body } = fixture();
    s.lastBotActions = ["sprint-right"];
    s.sprintDirection = 1;
    s.sprintHoldMs = 100;
    s.preparePhysics(116, 16);
    expect(s.sprintHoldMs).toBe(116);
    expect(body.velocity.x).toBe(rampedSprintSpeed(116));
    s.sinceLastBotTick = 33;
    s.observeAndAct(116, 16);
    await s.pendingDecision;
    const state = vi.mocked(s.controller.getNextActions).mock.calls[0][0].botState;
    expect(state.velocity.vx).toBe(body.velocity.x);
    expect(state.sprintRampProgress).toBe(116 / 450);
    expect(s.sprintHoldMs).toBe(116);
  });

  it("keeps live input until a late response is available, without applying inside the response callback", async () => {
    const { s, body } = fixture();
    s.lastBotActions = ["right"];
    s.sinceLastBotTick = 33;
    let resolve!: (actions: Action[]) => void;
    vi.mocked(s.controller.getNextActions).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    s.observeAndAct(100, 16);
    s.preparePhysics(116, 16);
    expect(body.velocity.x).toBe(200);
    resolve(["sprint-left"]);
    await s.pendingDecision;
    expect(body.velocity.x).toBe(200);
    expect(s.sprintHoldMs).toBe(0);
    s.observeAndAct(116, 16);
    expect(body.velocity.x).toBe(200);
    s.preparePhysics(132, 16);
    expect(body.velocity.x).toBe(-rampedSprintSpeed(16));
    expect(s.sprintHoldMs).toBe(16);
  });

  it("uses the step start time for jump-cut, not the future observation time", () => {
    const { s, body } = fixture();
    s.elapsedMs = 164;
    s.jumpStartMs = 0;
    body.blocked.down = false;
    body.velocity.y = -200;
    s.preparePhysics(180, 16);
    expect(body.velocity.y).toBe(-200);
    s.observeAndAct(180, 16);
    expect(body.velocity.y).toBe(-200);
    s.preparePhysics(196, 16);
    expect(body.velocity.y).toBe(0);
  });

  it("reads keyboard multi-input once per preupdate, never in postupdate", () => {
    const { s, body } = fixture();
    const keys = {
      left: { isDown: false },
      right: { isDown: true },
      space: { isDown: true },
      shift: { isDown: true },
    };
    const keyboard = new KeyboardController(keys);
    const read = vi.spyOn(keyboard, "getInput");
    Object.assign(s, { keyboardController: keyboard });
    s.preparePhysics(116, 16);
    expect(read).toHaveBeenCalledTimes(1);
    expect(body.velocity.x).toBe(rampedSprintSpeed(16));
    expect(body.velocity.y).toBeLessThan(0);
    expect(s.jumpStartMs).toBe(100);
    keys.right.isDown = false;
    keys.space.isDown = false;
    s.observeAndAct(116, 16);
    expect(read).toHaveBeenCalledTimes(1);
    expect(s.sprintHoldMs).toBe(16);
    s.preparePhysics(132, 16);
    expect(read).toHaveBeenCalledTimes(2);
    expect(body.velocity.x).toBe(0);
    expect(s.sprintHoldMs).toBe(0);
  });
});

describe("RaceScene sprint and external impulses", () => {
  it("resets sprint on idle, walking and reversal", () => {
    const { s } = fixture();
    s.applyMovement(1, true, false);
    s.applyMovement(1, true, false);
    expect(s.sprintHoldMs).toBe(32);
    s.applyMovement(-1, true, false);
    expect(s.sprintHoldMs).toBe(16);
    s.applyMovement(0, false, false);
    expect(s.sprintHoldMs).toBe(0);
    s.applyMovement(1, true, false);
    s.applyMovement(1, false, false);
    expect(s.sprintHoldMs).toBe(0);
  });

  it.each(["boingo", "stomp"])(
    "%s clears the normal jump timer and survives released jump",
    (kind) => {
      const { s, body } = fixture();
      s.jumpStartMs = 0;
      s.elapsedMs = 500;
      body.blocked.down = false;
      body.velocity.y = 100;
      if (kind === "boingo") s.onUtilityOverlap(sprite("spring", 80, 460, "boingo"));
      else {
        Object.assign(s, { playVanishEffect: vi.fn() });
        s.onHazardOverlap(sprite("patrol", 80, 460));
      }
      const impulse = body.velocity.y;
      expect(impulse).toBeLessThan(0);
      expect(s.jumpStartMs).toBeNull();
      s.applyMovement(0, false, false);
      expect(body.velocity.y).toBe(impulse);
    }
  );

  it("does not overwrite a bounce with a held jump on stale ground contact", () => {
    const { s, body } = fixture();
    body.velocity.y = 100;
    s.onUtilityOverlap(sprite("spring", 80, 460, "boingo"));
    s.applyMovement(1, false, true);
    expect(body.velocity.y).toBe(-820);
    expect(s.jumpStartMs).toBeNull();
  });

  it("clears jump phase on a completed landing before observation", async () => {
    const { s, body } = fixture();
    s.jumpStartMs = 1;
    body.velocity.y = 0;
    s.fireBotTick();
    await s.pendingDecision;
    expect(vi.mocked(s.controller.getNextActions).mock.calls[0][0].botState).toMatchObject({
      navigation: {
        movement: { jumpStartedAtMs: null, impulseKind: "none", impulseAtMs: null, sourceId: null },
      },
    });
  });
});
