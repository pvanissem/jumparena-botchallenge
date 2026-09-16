import type { Action, ToolsApi } from "@arena/bot-contract";
import { createNavigator } from "@arena/bot-navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotRunRecorder } from "../game/trace/BotRunRecorder";
import { validateNavigationDiagnostic } from "../game/trace/navigationDiagnostic";
import type { BotDecisionTrace } from "../game/trace/types";
import { BotRunner } from "./BotRunner";
import { createBotWorkerRuntime } from "./botWorkerRuntime";
import { FakeWorker } from "./testUtils/FakeWorker";
import { navigation, sampleState } from "./testUtils/sampleState";

const state = { ...sampleState, navigation };
const request = { type: "tick" as const, tick: 0, stateTick: 42, epoch: 2, stateFrame: 10, state };
const diagnostic = {
  targetId: "goal",
  routeId: "route-1",
  planId: "plan-1",
  phase: "execute",
  reason: "route-selected",
  relevantObjectIds: ["floor"],
  searchBudgetStatus: "available",
};
const code =
  "export default { apiVersion: 1, frameworkVersion: 1, decide(s, t) { return t.navigate(); } };";

describe("navigation transport", () => {
  afterEach(() => vi.useRealTimers());

  function setup(raw: unknown = diagnostic) {
    const getDiagnostics = vi.fn(() => raw);
    const decide = vi.fn((): Action[] => ["right"]);
    const runtime = createBotWorkerRuntime(() => ({ decide, getDiagnostics, reset() {} }));
    return { runtime, getDiagnostics, decide };
  }

  it("reads diagnostics once after navigation and snapshots actions before bot mutation", () => {
    const { runtime, getDiagnostics, decide } = setup();
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => {
        const actions = tools.navigate();
        actions[0] = "left";
        return actions;
      },
    });
    const result = runtime.tick(request);
    expect(result).toMatchObject({
      type: "action",
      stateFrame: 10,
      actions: ["left"],
      navigation: { ...diagnostic, navigationActions: ["right"] },
    });
    expect(getDiagnostics).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("never invents navigation for legacy bots or ticks that did not navigate", () => {
    const { runtime, getDiagnostics } = setup();
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => tools.navigate(),
    });
    runtime.tick(request);
    runtime.init({ apiVersion: 1, frameworkVersion: 1, decide: () => [] });
    expect(runtime.tick(request)).not.toHaveProperty("navigation");
    runtime.init({ apiVersion: 1, decide: () => [] });
    expect(runtime.tick(request)).not.toHaveProperty("navigation");
    expect(getDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("expires tools before reading diagnostics", () => {
    let saved: ToolsApi | undefined;
    const runtime = createBotWorkerRuntime(() => ({
      decide: () => [],
      reset() {},
      getDiagnostics() {
        expect(() => saved?.navigate()).toThrow(/synchron/);
        return diagnostic;
      },
    }));
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => {
        saved = tools;
        return tools.navigate();
      },
    });
    expect(runtime.tick(request)).toMatchObject({ type: "action", navigation: diagnostic });
  });

  it("does not carry diagnostics from a previous tick into a skipped or failed decision", () => {
    const { runtime, getDiagnostics } = setup();
    let mode = "navigate";
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => {
        if (mode === "skip") return [];
        const actions = tools.navigate();
        if (mode === "error") throw new Error("strategy failed");
        return actions;
      },
    });
    expect(runtime.tick(request)).toHaveProperty("navigation");
    mode = "skip";
    expect(runtime.tick({ ...request, tick: 1 })).not.toHaveProperty("navigation");
    mode = "error";
    const failed = runtime.tick({ ...request, tick: 2 });
    expect(failed).toMatchObject({ type: "error", stateTick: 42, epoch: 2, stateFrame: 10 });
    expect(failed).not.toHaveProperty("navigation");
    expect(getDiagnostics).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...diagnostic, extra: "unknown" },
    { ...diagnostic, relevantObjectIds: Array(32).fill("x".repeat(128)) },
  ])("drops invalid/oversized diagnostics before transport and again at the host", (raw) => {
    const { runtime } = setup(raw);
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => tools.navigate(),
    });
    expect(runtime.tick(request)).not.toHaveProperty("navigation");
    const worker = new FakeWorker();
    const observer = { onDecision: vi.fn(), onPaused: vi.fn() };
    const runner = new BotRunner(worker, { observer });
    runner.init(code);
    worker.emit({ type: "module-ready" });
    void runner.tick(state);
    worker.emit({
      type: "action",
      tick: 0,
      stateTick: 42,
      epoch: 2,
      actions: ["right"],
      navigation: raw,
    });
    expect(observer.onDecision.mock.calls[0][0]).not.toHaveProperty("navigation");
    runner.dispose();
  });

  it.each([
    [["left"], true],
    [["fly", "right"], false],
  ])("detects overrides after host normalization: %j", async (actions, overridden) => {
    const worker = new FakeWorker();
    const observer = { onDecision: vi.fn(), onPaused: vi.fn() };
    const runner = new BotRunner(worker, { observer });
    runner.init(code);
    worker.emit({ type: "module-ready" });
    const pending = runner.tick(state);
    worker.emit({
      type: "action",
      tick: 0,
      stateTick: 42,
      epoch: 2,
      stateFrame: 10,
      actions,
      navigation: { ...diagnostic, navigationActions: ["right"] },
    });
    await pending;
    expect(observer.onDecision.mock.calls[0][0]).toMatchObject({
      stateTick: 42,
      epoch: 2,
      stateFrame: 10,
      navigation: {
        ...diagnostic,
        navigationActions: ["right"],
        ...(overridden ? { actionOverride: "navigation-output-overridden" } : {}),
      },
    });
    if (!overridden)
      expect(observer.onDecision.mock.calls[0][0].navigation).not.toHaveProperty("actionOverride");
    runner.dispose();
  });

  it.each(["action", "error", "timeout"])(
    "correlates %s with the captured state, not mutable input or worker frame",
    async (kind) => {
      vi.useFakeTimers();
      const worker = new FakeWorker();
      const observer = { onDecision: vi.fn(), onPaused: vi.fn() };
      const runner = new BotRunner(worker, { observer });
      runner.init(code);
      worker.emit({ type: "module-ready" });
      const input = { ...state, navigation: { ...navigation } };
      const pending = runner.tick(input);
      expect(worker.sentMessages.at(-1)).toMatchObject({ stateTick: 42, epoch: 2, stateFrame: 10 });
      input.tick = 99;
      input.navigation.frame = 99;
      if (kind === "timeout") await vi.advanceTimersByTimeAsync(5);
      else {
        worker.emit({
          type: "action",
          tick: 0,
          stateTick: 42,
          epoch: 2,
          stateFrame: 9,
          actions: ["left"],
        });
        expect(observer.onDecision).not.toHaveBeenCalled();
        worker.emit(
          kind === "action"
            ? {
                type: "action",
                tick: 0,
                stateTick: 42,
                epoch: 2,
                stateFrame: 10,
                actions: ["right"],
              }
            : { type: "error", tick: 0, stateTick: 42, epoch: 2, stateFrame: 10, message: "failed" }
        );
      }
      await pending;
      expect(observer.onDecision).toHaveBeenCalledWith({
        tick: 0,
        stateTick: 42,
        epoch: 2,
        stateFrame: 10,
        kind: kind === "action" ? "ok" : kind === "error" ? "runtime-error" : "timeout",
        actions: kind === "action" ? ["right"] : [],
        ...(kind === "error" ? { message: "failed" } : {}),
      });
      runner.dispose();
    }
  );

  it("smoke: real navigator flows through pure runtime, runner and recorder", async () => {
    const input = {
      ...state,
      goalDirection: { dx: 950, dy: 280 },
      worldBounds: { width: 1200, height: 600 },
      platforms: [
        {
          id: "floor",
          dx: 0,
          dy: 300,
          width: 1000,
          height: 32,
          kind: "ground" as const,
          collision: "solid" as const,
        },
      ],
      navigation: {
        ...navigation,
        body: { x: 80, y: 268, width: 24, height: 32 },
        viewport: { x: 0, y: 0, width: 1100, height: 600 },
      },
    };
    const runtime = createBotWorkerRuntime(createNavigator);
    const worker = new FakeWorker();
    const recorder = new BotRunRecorder({
      levelId: "test",
      sessionId: "test",
      botRevision: "test",
      startedAt: "2026-09-15T00:00:00Z",
      initial: { position: input.position, coinsCollected: 0, fruitScore: 0 },
    });
    const observer = {
      onDecision: vi.fn((result: BotDecisionTrace) => recorder.recordDecision(result)),
      onPaused: vi.fn(),
    };
    const runner = new BotRunner(worker, { observer });
    worker.postMessage.mockImplementation((message) => {
      worker.emit(
        message.type === "init"
          ? runtime.init({
              apiVersion: 1,
              frameworkVersion: 1,
              decide: (_: unknown, tools: ToolsApi) => tools.navigate(),
            })
          : runtime.tick(message)
      );
    });
    runner.init(code);
    await expect(runner.whenReady()).resolves.toBe(true);
    recorder.recordState(input);
    const actions = await runner.tick(input);
    expect(actions.length).toBeGreaterThan(0);
    const result = observer.onDecision.mock.calls[0][0];
    expect(result).toMatchObject({ kind: "ok", tick: 0, stateTick: 42, epoch: 2, stateFrame: 10 });
    expect(validateNavigationDiagnostic(result.navigation, actions)).toEqual(result.navigation);
    expect(result.navigation).toBeDefined();
    const trace = recorder.finish("finished", "smoke", {
      position: input.position,
      coinsCollected: 0,
      fruitScore: 0,
    });
    expect(
      trace?.windows
        .flatMap((window) => window.samples)
        .some((sample) => sample.decision?.navigation)
    ).toBe(true);
    runner.dispose();
  });
});
