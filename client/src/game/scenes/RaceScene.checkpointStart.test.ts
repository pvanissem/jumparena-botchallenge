import EventEmitter from "eventemitter3";
import { expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: { Scene: class {} } }));
vi.mock("../assets/animations", () => ({ createAnimations: vi.fn() }));
vi.mock("../world/worldBuilder", () => ({ buildWorld: vi.fn(() => ({})), WORLD_DEPTH: {} }));

import { LEVEL_ONE } from "../level/levelOne";
import type { RacerRuntimeState } from "../rules/racerState";
import { buildWorld } from "../world/worldBuilder";
import { RaceScene } from "./RaceScene";

function createScene() {
  const scene = new RaceScene();
  const checkpoint = LEVEL_ONE.checkpoints[0];
  const player = {
    setDepth: vi.fn(),
    setCollideWorldBounds: vi.fn(),
    play: vi.fn(),
    setScale: vi.fn(),
    body: { setSize: vi.fn() },
  };
  const spawn = vi.fn(() => player);
  const onStatusChange = vi.fn();
  const events = new EventEmitter();
  const dispose = vi.fn();
  Object.assign(scene, {
    elapsedMs: 12345,
    frameCounter: 40,
    physics: { add: { sprite: spawn, collider: vi.fn(), overlap: vi.fn() } },
    cameras: { main: { startFollow: vi.fn(), setBounds: vi.fn() } },
    events,
    createController: () => ({ dispose }),
  });
  scene.init({
    controllerMode: "keyboard",
    levelId: "level-one",
    startCheckpointId: checkpoint.id,
    audio: false,
    onStatusChange,
  });
  scene.create();
  return { scene, checkpoint, spawn, events, dispose, onStatusChange };
}

it("creates fresh world/time and the player at the chosen checkpoint", () => {
  const { scene, checkpoint, spawn, onStatusChange } = createScene();
  expect(spawn).toHaveBeenCalledWith(checkpoint.x, checkpoint.y - 80, expect.any(String));
  expect(buildWorld).toHaveBeenCalledWith(scene, LEVEL_ONE);
  const internals = scene as unknown as {
    elapsedMs: number;
    frameCounter: number;
    racer: RacerRuntimeState;
  };
  expect(internals.elapsedMs).toBe(0);
  expect(internals.frameCounter).toBe(0);
  expect(internals.racer).toMatchObject({
    timeElapsedMs: 0,
    coinsCollected: 0,
    lastCheckpoint: { x: checkpoint.x, y: checkpoint.y },
  });
  expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ racer: internals.racer }));
});

it.each(["destroy", "shutdown"])(
  "cleans the controller and detaches step handlers on %s",
  (event) => {
    const { scene, events, dispose } = createScene();
    const finish = vi.fn();
    Object.assign(scene, { telemetry: { finish } });
    expect(events.listenerCount("preupdate")).toBe(1);
    events.emit(event);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(events.listenerCount("preupdate")).toBe(0);
    expect(events.listenerCount("postupdate")).toBe(0);
    expect(finish).toHaveBeenCalledWith("aborted", "scene-shutdown", expect.any(Object));
    events.emit("destroy");
    events.emit("shutdown");
    expect(dispose).toHaveBeenCalledTimes(1);
  }
);

it("passes actual checkpoint bodies from the scene through the bot state", async () => {
  const { buildBotState } = await import("../state/botStateBuilder");
  const { scene, checkpoint } = createScene();
  const flag = {
    active: true,
    x: checkpoint.x,
    y: checkpoint.y - 32,
    body: { enable: true, x: checkpoint.x - 19, y: checkpoint.y - 54, width: 38, height: 48 },
    getData: () => checkpoint.id,
  };
  Object.assign(scene, {
    world: {
      hazardInstances: [],
      utilityInstances: [],
      blocks: { getChildren: () => [] },
      coins: { getChildren: () => [] },
      checkpoints: { getChildren: () => [flag, { ...flag, active: false }] },
      goal: { active: false },
    },
  });
  const internal = scene as unknown as {
    buildSnapshot(): import("../state/worldSnapshot").WorldSnapshot;
    racer: RacerRuntimeState;
  };
  const state = buildBotState(internal.buildSnapshot(), internal.racer, 0, {
    velocity: { vx: 0, vy: 0 },
    isSprinting: false,
    sprintHoldMs: 0,
    justRespawned: false,
    tookDamage: false,
  });
  expect(state.checkpoints).toEqual([
    {
      id: checkpoint.id,
      dx: 0,
      dy: 48,
      bounds: { dx: -19, dy: 26, width: 38, height: 48 },
      reached: true,
      active: true,
    },
  ]);
  expect(state.respawnPoint).toEqual({
    checkpointId: checkpoint.id,
    x: checkpoint.x,
    y: checkpoint.y - 32,
  });
});
