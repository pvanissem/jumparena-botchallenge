import type { Action, ControlCommand, ControlStatus, ToolsApi } from "@arena/bot-contract";
import { createMovementController } from "@arena/bot-navigation";
import { describe, expect, it, vi } from "vitest";
import { BotRunRecorder } from "../game/trace/BotRunRecorder";
import { validateNavigationDiagnostic } from "../game/trace/navigationDiagnostic";
import { focusTrace } from "../game/trace/readBotTrace";
import { createBotWorkerRuntime } from "./botWorkerRuntime";
import { navigation, sampleState } from "./testUtils/sampleState";

const command: ControlCommand = { id: "walk-1", kind: "walk", x: 300 };
const request = {
  type: "tick" as const,
  tick: 7,
  stateTick: 42,
  epoch: 2,
  state: { ...sampleState, navigation },
};
function setup() {
  const run = vi.fn((): Action[] => ["right"]);
  const status = vi.fn(
    (): ControlStatus => ({
      commandId: "walk-1",
      state: "running",
      phase: "approach",
      reason: null,
    })
  );
  const reset = vi.fn();
  const factory = vi.fn(() => ({ run, status, reset }));
  return { runtime: createBotWorkerRuntime(factory), factory, run, status, reset };
}

describe("worker control tools v2", () => {
  it.each(["wait", "replace", "continue"])(
    "preserves wrong-landing through recording and reading when the bot chooses %s",
    (choice) => {
      const runtime = createBotWorkerRuntime(createMovementController);
      const jump: ControlCommand = { id: "old-jump", kind: "jump", platformId: "floor", x: 232 };
      const state = structuredClone({ ...sampleState, navigation });
      state.platforms = [{ id: "floor", dx: 0, dy: 32, width: 400, height: 16, kind: "ground" }];
      const initial = { position: state.position, coinsCollected: 0, fruitScore: 0 };
      const recorder = new BotRunRecorder({
        levelId: "test",
        sessionId: "test",
        botRevision: "bot",
        startedAt: "2026-09-17",
        initial,
      });
      runtime.init({
        apiVersion: 1,
        frameworkVersion: 2,
        decide: (_: unknown, tools: ToolsApi) => {
          if (tools.status().state !== "failed" && state.tick < 45) return tools.run(jump);
          if (choice === "wait") return [];
          return tools.run(choice === "replace" ? command : jump);
        },
      });
      function tick() {
        recorder.recordState(state);
        const response = runtime.tick({
          ...request,
          tick: state.tick,
          stateTick: state.tick,
          state,
        });
        if (response.type !== "action") throw Error(JSON.stringify(response));
        const diagnostic = validateNavigationDiagnostic(response.navigation);
        expect(diagnostic).toEqual(response.navigation);
        recorder.recordDecision({
          ...response,
          kind: "ok",
          actions: response.actions as Action[],
          navigation: diagnostic,
        });
        return { ...response, navigation: diagnostic };
      }
      tick();
      state.tick++;
      state.navigation.observedAtMs += 33;
      state.onGround = false;
      state.navigation.body.y = -50;
      tick();
      state.tick++;
      state.navigation.observedAtMs += 33;
      state.onGround = true;
      state.navigation.body.y = 0;
      const response = tick();
      const transition = {
        commandId: "old-jump",
        targetId: "floor",
        state: "failed",
        phase: "flight",
        reason: "wrong-landing",
      };
      expect(response.navigation).toMatchObject({
        planId: choice === "replace" ? "walk-1" : "old-jump",
        statusTransition: transition,
      });
      const trace = recorder.snapshot(initial);
      if (!trace) throw Error("Expected trace");
      expect(focusTrace(trace, state.tick, "bot").timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tick: state.tick, statusTransition: transition }),
        ])
      );
      state.tick++;
      state.navigation.observedAtMs += 33;
      expect(tick().navigation?.statusTransition).toBeUndefined();
      state.tick++;
      state.justRespawned = true;
      state.navigation.epoch++;
      expect(tick().navigation?.statusTransition).toBeUndefined();
    }
  );
  it("loads v2 metadata and rejects v1 before constructing a controller", () => {
    const { runtime, factory } = setup();
    expect(runtime.init({ apiVersion: 1, frameworkVersion: 1, decide: () => [] })).toMatchObject({
      type: "module-invalid",
    });
    expect(factory).not.toHaveBeenCalled();
    expect(runtime.init({ apiVersion: 1, frameworkVersion: 2, decide: () => [] })).toMatchObject({
      type: "module-ready",
      frameworkVersion: 2,
    });
  });
  it("keeps legacy arity and unbound invocation without creating a controller", () => {
    const { runtime, factory } = setup();
    const decide = vi.fn(function (this: unknown) {
      expect(this).toBeUndefined();
      return ["jump"];
    });
    runtime.init({ apiVersion: 1, decide });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: ["jump"] });
    expect(decide.mock.calls).toEqual([[request.state]]);
    expect(factory).not.toHaveBeenCalled();
  });
  it("updates observations before deciding and exposes frozen run/status/options tools", () => {
    const { runtime, factory, run, status } = setup();
    const decide = vi.fn((_state, tools: ToolsApi) => {
      expect(status).toHaveBeenCalledWith(request.state);
      expect(Object.isFrozen(tools)).toBe(true);
      expect(Object.keys(tools)).toEqual(["run", "status", "options"]);
      expect(tools.status()).toMatchObject({ commandId: "walk-1" });
      return tools.run(command);
    });
    runtime.init({ apiVersion: 1, frameworkVersion: 2, decide });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: ["right"] });
    runtime.tick({ ...request, tick: 8 });
    expect(decide.mock.calls[0]).toHaveLength(2);
    expect(run).toHaveBeenCalledWith(request.state, command);
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("resets command ownership for raw actions (run first: %s)", (used) => {
    const { runtime, reset } = setup();
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 2,
      decide: (_: unknown, tools: ToolsApi) => {
        if (used) {
          const actions = tools.run(command);
          actions[0] = "left";
          return actions;
        }
        return [];
      },
    });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: used ? ["left"] : [] });
    expect(reset).toHaveBeenCalledTimes(1);
  });
  it("keeps ownership for an unchanged copied helper result", () => {
    const { runtime, reset } = setup();
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 2,
      decide: (_: unknown, t: ToolsApi) => [...t.run(command)],
    });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: ["right"] });
    expect(reset).not.toHaveBeenCalled();
  });
  it("allows only one run even if its controller threw and expires captured tools", () => {
    const { runtime, run } = setup();
    run.mockImplementation(() => {
      throw Error("controller failed");
    });
    let saved: ToolsApi | undefined;
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 2,
      decide: (_: unknown, t: ToolsApi) => {
        saved = t;
        try {
          t.run(command);
        } catch {}
        return t.run(command);
      },
    });
    expect(runtime.tick(request)).toMatchObject({
      type: "error",
      message: expect.stringContaining("einmal"),
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(() => saved?.run(command)).toThrow(/synchron/);
    expect(() => saved?.status()).toThrow(/synchron/);
  });
  it("expires captured tools on a thrown bot error", () => {
    const { runtime } = setup();
    let saved: ToolsApi | undefined;
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 2,
      decide: (_: unknown, t: ToolsApi) => {
        saved = t;
        throw Error("strategy failed");
      },
    });
    expect(runtime.tick(request)).toMatchObject({
      type: "error",
      tick: 7,
      stateTick: 42,
      epoch: 2,
      message: "Error: strategy failed",
    });
    expect(() => saved?.status()).toThrow(/synchron/);
  });
  it("reports an unconnected factory while accepting legacy bots", () => {
    const runtime = createBotWorkerRuntime();
    expect(runtime.init({ apiVersion: 1, frameworkVersion: 2, decide: () => [] })).toMatchObject({
      type: "module-invalid",
      reason: expect.stringContaining("Controller"),
    });
    expect(runtime.init({ apiVersion: 1, decide: () => [] })).toMatchObject({
      type: "module-ready",
    });
  });
  it("passes invalid legacy actions to host normalization", () => {
    const { runtime } = setup();
    runtime.init({ apiVersion: 1, decide: () => ["fly", "left"] });
    expect(runtime.tick(request)).toMatchObject({ actions: ["fly", "left"] });
  });
  it("drops real controller ownership after an explicit stop", () => {
    const controller = createMovementController();
    const runtime = createBotWorkerRuntime(() => controller);
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 2,
      decide: (_: unknown, t: ToolsApi) => {
        t.run({ id: "jump", kind: "jump", platformId: "missing" });
        return ["left"];
      },
    });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: ["left"] });
    expect(controller.status(request.state)).toMatchObject({ commandId: null, state: "idle" });
  });
});

it("offers perception-based choices through the real worker", () => {
  const runtime = createBotWorkerRuntime(createMovementController);
  runtime.init({
    apiVersion: 1,
    frameworkVersion: 2,
    decide: (_: unknown, tools: ToolsApi) => {
      const choices = tools.options();
      return choices.length ? tools.run(choices[0].command) : [];
    },
  });
  const state = {
    ...sampleState,
    navigation: { ...navigation },
    onGround: true,
    position: { x: 80, y: 480 },
    platforms: [
      {
        id: "any-platform",
        dx: -80,
        dy: 20,
        width: 320,
        height: 16,
        kind: "ground" as const,
        collision: "solid" as const,
      },
    ],
    hazards: [],
  };
  state.navigation.body = { x: 68, y: 468, width: 24, height: 32 };
  expect(runtime.tick({ ...request, state })).toMatchObject({
    type: "action",
    actions: ["sprint-right"],
  });
});
