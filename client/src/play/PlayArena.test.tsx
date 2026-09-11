import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayArena } from "./PlayArena";

const gameInstances: { destroy: ReturnType<typeof vi.fn>; config: unknown }[] = [];

vi.mock("phaser", () => ({
  default: {
    AUTO: 0,
    Game: class {
      destroy = vi.fn();
      canvas = { width: 1200, height: 600 };
      scene = { add: vi.fn(), remove: vi.fn(), getScene: vi.fn(), pause: vi.fn(), resume: vi.fn() };
      constructor(public config: unknown) {
        gameInstances.push(this as never);
      }
    },
  },
}));

vi.mock("./PlayBootScene", () => ({
  PlayBootScene: class {},
  PLAY_BOOT_SCENE_KEY: "play-boot",
  PLAY_ASSETS_READY: "play-assets-ready",
}));

vi.mock("../game/audio/sharedAudioContext", () => ({ getSharedAudioContext: () => undefined }));

describe("PlayArena", () => {
  afterEach(() => {
    cleanup();
    gameInstances.length = 0;
  });

  it("erzeugt genau eine Phaser-Instanz", () => {
    render(<PlayArena onReady={vi.fn()} />);
    expect(gameInstances).toHaveLength(1);
  });

  it("startet ohne Physik-Debugdarstellung (Messestand-Optik)", () => {
    render(<PlayArena onReady={vi.fn()} />);
    const config = gameInstances[0].config as { physics: { arcade: { debug: boolean } } };
    expect(config.physics.arcade.debug).toBe(false);
  });

  it("meldet das erzeugte Game nach außen", () => {
    const onReady = vi.fn();
    render(<PlayArena onReady={onReady} />);
    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ canvas: { width: 1200, height: 600 } })
    );
  });

  it("zerstört die Instanz beim Abbau", () => {
    const { unmount } = render(<PlayArena onReady={vi.fn()} />);
    unmount();
    expect(gameInstances[0].destroy).toHaveBeenCalledWith(true);
  });
});
