import type { Action, ToolsApi } from "@arena/bot-contract";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createBotWorkerRuntime } from "./botWorkerRuntime";
import { navigation, sampleState } from "./testUtils/sampleState";
import type { WorkerToHostMessage } from "./workerLike";

function setup() {
  const decide = vi.fn((): Action[] => ["right"]);
  const createNavigator = vi.fn(() => ({ decide, getDiagnostics: () => null, reset: vi.fn() }));
  return { runtime: createBotWorkerRuntime(createNavigator), createNavigator, decide };
}

const request = {
  type: "tick" as const,
  tick: 7,
  stateTick: 42,
  epoch: 2,
  state: { ...sampleState, navigation },
};

describe("pure worker runtime", () => {
  it("reports the optional framework version from the validated module in ready metadata", () => {
    const { runtime } = setup();
    const ready = runtime.init({ apiVersion: 1, frameworkVersion: 1, decide: () => [] });
    expect(ready).toMatchObject({ type: "module-ready", frameworkVersion: 1 });
    expectTypeOf<
      Extract<WorkerToHostMessage, { type: "module-ready" }>["frameworkVersion"]
    >().toEqualTypeOf<1 | undefined>();
    expect(runtime.init({ apiVersion: 1, decide: () => [] })).not.toHaveProperty(
      "frameworkVersion"
    );
  });

  it("calls legacy bots with exactly one argument and no navigator", () => {
    const { runtime, createNavigator } = setup();
    const decide = vi.fn(() => ["jump"]);
    expect(runtime.init({ apiVersion: 1, name: "Old", decide })).toMatchObject({
      type: "module-ready",
      name: "Old",
    });
    expect(runtime.tick(request)).toEqual({
      type: "action",
      tick: 7,
      stateTick: 42,
      epoch: 2,
      actions: ["jump"],
    });
    expect(decide.mock.calls).toEqual([[request.state]]);
    expect(createNavigator).not.toHaveBeenCalled();
  });

  it("passes frozen tools as exactly the second argument and binds navigate to this state", () => {
    const { runtime, createNavigator, decide: navigate } = setup();
    const choose = vi.fn(() => null);
    const decide = vi.fn((_state, tools: ToolsApi) => {
      expect(Object.isFrozen(tools)).toBe(true);
      expect(Object.keys(tools)).toEqual(["navigate"]);
      return tools.navigate({ choose });
    });
    runtime.init({ apiVersion: 1, frameworkVersion: 1, decide });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: ["right"] });
    expect(decide.mock.calls[0]).toHaveLength(2);
    expect(navigate.mock.calls).toEqual([[request.state, choose]]);
    runtime.tick({ ...request, tick: 8 });
    expect(createNavigator).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it("gives each bot its own persistent navigator", () => {
    const createNavigator = vi.fn(() => {
      let calls = 0;
      return {
        decide: (): Action[] => [++calls === 1 ? "left" : "right"],
        getDiagnostics: () => null,
        reset: vi.fn(),
      };
    });
    const first = createBotWorkerRuntime(createNavigator);
    const second = createBotWorkerRuntime(createNavigator);
    const bot = {
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => tools.navigate(),
    };
    first.init(bot);
    second.init(bot);
    expect(first.tick(request)).toMatchObject({ actions: ["left"] });
    expect(first.tick(request)).toMatchObject({ actions: ["right"] });
    expect(second.tick(request)).toMatchObject({ actions: ["left"] });
    expect(createNavigator).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported framework versions before constructing navigation", () => {
    const { runtime, createNavigator } = setup();
    expect(runtime.init({ apiVersion: 1, frameworkVersion: 2, decide() {} })).toMatchObject({
      type: "module-invalid",
      reason: expect.stringContaining("frameworkVersion 2"),
    });
    expect(createNavigator).not.toHaveBeenCalled();
    expect(runtime.tick(request)).toMatchObject({ type: "error" });
  });

  it("reports the unconnected navigator factory explicitly but still loads old bots", () => {
    const runtime = createBotWorkerRuntime();
    expect(runtime.init({ apiVersion: 1, frameworkVersion: 1, decide() {} })).toMatchObject({
      type: "module-invalid",
      reason: expect.stringContaining("Navigator"),
    });
    const legacy = createBotWorkerRuntime();
    expect(
      legacy.init({
        apiVersion: 1,
        decide() {
          return [];
        },
      })
    ).toMatchObject({ type: "module-ready" });
  });

  it.each([undefined, { ...navigation, version: 2 }])(
    "reports missing/unsupported observation %p",
    (observation) => {
      const { runtime, decide } = setup();
      runtime.init({
        apiVersion: 1,
        frameworkVersion: 1,
        decide: (_: unknown, tools: ToolsApi) => tools.navigate(),
      });
      expect(
        runtime.tick({ ...request, state: { ...sampleState, navigation: observation } as never })
      ).toMatchObject({
        type: "error",
        message: expect.stringContaining("navigation.version 1"),
      });
      expect(decide).not.toHaveBeenCalled();
    }
  );

  it("rejects a second navigate even if the first navigator call threw", () => {
    const { runtime, decide } = setup();
    decide.mockImplementation(() => {
      throw new Error("planner failed");
    });
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => {
        try {
          tools.navigate();
        } catch {
          /* Second call must still fail. */
        }
        return tools.navigate();
      },
    });
    expect(runtime.tick(request)).toMatchObject({
      type: "error",
      message: expect.stringContaining("einmal"),
    });
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("rejects repeated navigate calls and expires captured tools on return and later ticks", async () => {
    const { runtime } = setup();
    let saved: ToolsApi | undefined;
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => {
        if (saved) expect(() => saved?.navigate()).toThrow(/synchron/);
        saved = tools;
        tools.navigate();
        return tools.navigate();
      },
    });
    expect(runtime.tick(request)).toMatchObject({
      type: "error",
      message: expect.stringContaining("einmal"),
    });
    expect(() => saved?.navigate()).toThrow(/synchron/);
    await Promise.resolve();
    expect(() => saved?.navigate()).toThrow(/synchron/);
    expect(runtime.tick(request)).toMatchObject({
      type: "error",
      message: expect.stringContaining("einmal"),
    });
  });

  it("expires tools when decide throws, and forwards errors with correlation", () => {
    const { runtime } = setup();
    let saved: ToolsApi | undefined;
    runtime.init({
      apiVersion: 1,
      frameworkVersion: 1,
      decide: (_: unknown, tools: ToolsApi) => {
        saved = tools;
        throw new Error("strategy failed");
      },
    });
    expect(runtime.tick(request)).toEqual({
      type: "error",
      tick: 7,
      stateTick: 42,
      epoch: 2,
      message: "Error: strategy failed",
    });
    expect(() => saved?.navigate()).toThrow(/synchron/);
  });

  it("passes invalid results through unchanged for host normalization", () => {
    const { runtime } = setup();
    runtime.init({ apiVersion: 1, decide: () => ["fly", "left"] });
    expect(runtime.tick(request)).toMatchObject({ type: "action", actions: ["fly", "left"] });
  });
});
