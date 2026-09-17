import type { ToolsApi } from "@arena/bot-contract";
import { createMovementController } from "@arena/bot-navigation";
import { expect, it } from "vitest";
import { fixture, platform } from "../../../packages/bot-navigation/src/fixtures";
import { createBotWorkerRuntime } from "./botWorkerRuntime";

it("reports the attacked enemy as well as the landing surface in the trace", () => {
  const runtime = createBotWorkerRuntime(createMovementController),
    state = fixture();
  state.position = { x: 92, y: 284 };
  state.platforms = [platform("floor", -92, 16, 1000)];
  state.hazards = [
    {
      id: "frog",
      kind: "ninjafrog",
      dx: 120,
      dy: 0,
      bounds: { dx: 110, dy: -10, width: 20, height: 26 },
      active: true,
      warning: false,
      stompable: true,
      vx: 60,
      vy: 0,
    },
  ];
  runtime.init({
    apiVersion: 1,
    frameworkVersion: 2,
    name: "Test",
    author: "Test",
    decide: (_: unknown, tools: ToolsApi) =>
      tools.navigate({
        target: { kind: "goal" },
        enemies: "stomp",
      }),
  });
  const result = runtime.tick({
    type: "tick",
    tick: 0,
    stateTick: 0,
    stateFrame: 0,
    epoch: 1,
    state,
  });
  expect(result).toMatchObject({
    type: "action",
    navigation: {
      relevantObjectIds: expect.arrayContaining(["frog", "floor"]),
    },
  });
});

it("transports goal navigation and releases it when visitor actions take over", () => {
  const runtime = createBotWorkerRuntime(createMovementController);
  const state = fixture();
  state.position = { x: 92, y: 284 };
  state.platforms = [platform("floor", -92, 16, 1000)];
  let useNavigation = true;
  runtime.init({
    apiVersion: 1,
    frameworkVersion: 2,
    name: "Test",
    author: "Test",
    decide: (_: unknown, tools: ToolsApi) =>
      useNavigation ? tools.navigate({ target: { kind: "goal" } }) : ["left"],
  });
  const tick = () =>
    runtime.tick({
      type: "tick",
      tick: state.tick,
      stateTick: state.tick,
      stateFrame: state.tick,
      epoch: 1,
      state,
    });
  expect(tick()).toMatchObject({
    type: "action",
    actions: expect.arrayContaining(["sprint-right"]),
    navigation: { phase: "execute", navigationActions: expect.arrayContaining(["sprint-right"]) },
  });
  state.tick++;
  useNavigation = false;
  expect(tick()).toMatchObject({ type: "action", actions: ["left"] });
  state.tick++;
  useNavigation = true;
  expect(tick()).toMatchObject({
    type: "action",
    actions: expect.arrayContaining(["sprint-right"]),
  });
});

it("rejects mixing navigate and run in one decision", () => {
  const runtime = createBotWorkerRuntime(createMovementController),
    state = fixture();
  runtime.init({
    apiVersion: 1,
    frameworkVersion: 2,
    name: "Test",
    author: "Test",
    decide: (_: unknown, tools: ToolsApi) => {
      tools.navigate({ target: { kind: "goal" } });
      return tools.run({ id: "second", kind: "walk", x: 200 });
    },
  });
  expect(
    runtime.tick({ type: "tick", tick: 0, stateTick: 0, stateFrame: 0, epoch: 1, state })
  ).toMatchObject({ type: "error", message: expect.stringContaining("einmal") });
});

it("resets navigation when its returned actions are replaced in the same decision", () => {
  const controller = createMovementController();
  let resets = 0;
  const runtime = createBotWorkerRuntime(() => ({
    ...controller,
    reset() {
      resets++;
      controller.reset();
    },
  }));
  const state = fixture();
  runtime.init({
    apiVersion: 1,
    frameworkVersion: 2,
    name: "Test",
    author: "Test",
    decide: (_: unknown, tools: ToolsApi) => {
      tools.navigate({ target: { kind: "goal" } });
      return ["left"];
    },
  });
  expect(
    runtime.tick({ type: "tick", tick: 0, stateTick: 0, stateFrame: 0, epoch: 1, state })
  ).toMatchObject({ type: "action", actions: ["left"] });
  expect(resets).toBe(1);
  expect(controller.status(state).state).toBe("idle");
});
