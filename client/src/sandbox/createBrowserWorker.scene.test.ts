import { afterEach, describe, expect, it, vi } from "vitest";
import type { BotRunner } from "./BotRunner";
import type { WorkerToHostMessage } from "./workerLike";

vi.mock("phaser", () => ({
  default: { Scene: class {}, Animations: { Events: { ANIMATION_COMPLETE: "complete" } } },
}));

import { RaceScene, type RaceSceneInitData } from "../game/scenes/RaceScene";

describe("RaceScene with the real browser worker adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("delivers module readiness directly to the runner without a scene metadata wrapper", async () => {
    const setOnMessage = vi.fn();
    const native = {
      set onmessage(handler: (event: { data: WorkerToHostMessage }) => void) {
        setOnMessage(handler);
      },
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    vi.stubGlobal(
      "Worker",
      vi.fn(() => native)
    );
    const scene = new RaceScene();
    const internals = scene as unknown as {
      initData: RaceSceneInitData;
      createController(): { dispose(): void };
      botRunner: BotRunner;
      botReady: boolean;
    };
    internals.initData = {
      controllerMode: "bot",
      botSourceCode:
        "export default { apiVersion: 1, frameworkVersion: 2, decide() { return []; } };",
    };
    Object.assign(scene, { physics: { world: { pause: vi.fn() } } });
    // Only the native Worker and Phaser shell are mocked, not the adapter or runner.
    const controller = internals.createController();
    try {
      expect(native.postMessage).toHaveBeenCalledWith({
        type: "init",
        code: internals.initData.botSourceCode,
      });
      expect(setOnMessage).toHaveBeenCalledTimes(1);
      expect(internals.botReady).toBe(false);
      expect(() =>
        setOnMessage.mock.calls[0][0]({ data: { type: "module-ready", frameworkVersion: 2 } })
      ).not.toThrow();
      await expect(internals.botRunner.whenReady()).resolves.toBe(true);
      expect(internals.botReady).toBe(true);
      expect(internals.botRunner.pausedReason).toBeNull();
      expect(native.postMessage).toHaveBeenCalledTimes(1);
    } finally {
      controller.dispose();
    }
    expect(native.terminate).toHaveBeenCalledTimes(1);
  });
});
