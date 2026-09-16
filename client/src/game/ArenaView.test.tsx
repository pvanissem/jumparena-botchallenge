import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";

const { start, destroy, created, scene, installGuard } = vi.hoisted(() => ({
  start: vi.fn(),
  destroy: vi.fn(),
  created: vi.fn(),
  scene: { shutdown: vi.fn(), setControllerMode: vi.fn() },
  installGuard: vi.fn(() => vi.fn()),
}));
vi.mock("phaser", () => ({
  default: {
    AUTO: 0,
    Input: { Keyboard: { KeyCodes: {} } },
    Game: class {
      constructor() {
        created();
      }
      scene = { start, getScene: () => scene };
      destroy = destroy;
    },
  },
}));
vi.mock("./scenes/RaceScene", () => ({ RaceScene: class {} }));
vi.mock("./audio/sharedAudioContext", () => ({ getSharedAudioContext: () => null }));
vi.mock("./input/keyboardCaptureGuard", () => ({ installKeyboardCaptureGuard: installGuard }));

import { ArenaView } from "./ArenaView";
import type { RaceSceneInitData } from "./scenes/RaceScene";
import type { BotRunTrace } from "./trace/types";

async function settleMount() {
  await act(async () => {
    await Promise.resolve();
  });
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("passes a selected checkpoint only to the new scene initialization", async () => {
  render(<ArenaView controlMode="bot" levelId="level-one" startCheckpointId="cp-3" />);
  await settleMount();
  expect(start).toHaveBeenCalledWith(
    "RaceScene",
    expect.objectContaining({ startCheckpointId: "cp-3", levelId: "level-one" })
  );
});
it("allocates only the live game under StrictMode effect replay", async () => {
  const { unmount } = render(
    <StrictMode>
      <ArenaView controlMode="bot" levelId="level-one" />
    </StrictMode>
  );
  await settleMount();
  expect(created).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  unmount();
  expect(destroy).toHaveBeenCalledTimes(1);
});
it("does not start a game if unmounted before the mount microtask", async () => {
  const { unmount } = render(<ArenaView controlMode="bot" levelId="level-one" />);
  unmount();
  await settleMount();
  expect(created).not.toHaveBeenCalled();
});
it("shuts down a ready scene immediately and ignores callbacks after unmount", async () => {
  const onStatusChange = vi.fn(),
    onTrace = vi.fn();
  const { unmount } = render(
    <ArenaView
      controlMode="bot"
      levelId="level-one"
      onStatusChange={onStatusChange}
      telemetry={{ sessionId: "live", onTrace }}
    />
  );
  await settleMount();
  const init = start.mock.calls[0][1] as RaceSceneInitData;
  init.onReady?.();
  expect(installGuard).toHaveBeenCalledTimes(1);
  unmount();
  expect(scene.shutdown).toHaveBeenCalledTimes(1);
  init.onStatusChange?.({} as never);
  init.telemetry?.onTrace({} as BotRunTrace);
  init.onReady?.();
  expect(onStatusChange).not.toHaveBeenCalled();
  expect(onTrace).not.toHaveBeenCalled();
  expect(installGuard).toHaveBeenCalledTimes(1);
});
it("stops a scene whose loader completes after unmount without publishing it", async () => {
  const { unmount } = render(<ArenaView controlMode="bot" levelId="level-one" />);
  await settleMount();
  const init = start.mock.calls[0][1] as RaceSceneInitData;
  unmount();
  init.onReady?.();
  expect(scene.shutdown).toHaveBeenCalledTimes(1);
  expect(installGuard).not.toHaveBeenCalled();
});
