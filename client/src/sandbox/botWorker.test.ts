import { createMovementController } from "@arena/bot-navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navigation, sampleState } from "./testUtils/sampleState";
import type { HostToWorkerMessage } from "./workerLike";

const { tick, factory } = vi.hoisted(() => ({ tick: vi.fn(), factory: vi.fn() }));
vi.mock("./botWorkerRuntime", () => ({
  createBotWorkerRuntime: factory.mockImplementation(() => ({ tick })),
}));

describe("worker entry point", () => {
  it("injects the real movement controller into the production runtime", async () => {
    vi.stubGlobal("self", {});
    await import("./botWorker");
    expect(factory).toHaveBeenLastCalledWith(createMovementController);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    tick.mockReset();
  });

  it("reports uncloneable bot results as correlated tick errors", async () => {
    const scope = {
      onmessage: null as ((event: { data: HostToWorkerMessage }) => void) | null,
      postMessage: vi.fn().mockImplementationOnce(() => {
        throw new Error("DataCloneError");
      }),
    };
    vi.stubGlobal("self", scope);
    tick.mockReturnValue({ type: "action", tick: 7, actions: () => [] });
    await import("./botWorker");
    expect(() =>
      scope.onmessage?.({
        data: {
          type: "tick",
          tick: 7,
          epoch: 2,
          stateTick: 42,
          state: { ...sampleState, navigation },
        },
      })
    ).not.toThrow();
    expect(scope.postMessage).toHaveBeenLastCalledWith({
      type: "error",
      tick: 7,
      epoch: 2,
      stateTick: 42,
      message: "Error: DataCloneError",
    });
  });
});
