import { describe, expect, it, vi } from "vitest";
import { MATCH_ASSETS_READY, MatchBootScene } from "./MatchBootScene";

vi.mock("phaser", () => ({
  default: {
    Scene: class {},
    Sound: { Events: { UNLOCKED: "unlocked" } },
  },
}));

describe("MatchBootScene", () => {
  it("announces loaded assets without starting background music", () => {
    const emit = vi.fn();
    const music = { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const add = vi.fn(() => music);
    const scene = new MatchBootScene();
    Object.defineProperty(scene, "game", { value: { events: { emit } } });
    Object.defineProperty(scene, "sound", {
      value: { locked: false, add, once: vi.fn() },
    });

    scene.create();

    expect(emit).toHaveBeenCalledWith(MATCH_ASSETS_READY);
    expect(add).not.toHaveBeenCalled();
    expect(music.play).not.toHaveBeenCalled();
  });
});
