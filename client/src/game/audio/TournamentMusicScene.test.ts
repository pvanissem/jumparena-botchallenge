import { describe, expect, it, vi } from "vitest";
import { AUDIO_KEYS } from "../assets/audio";
import type { AudioSettingsStore } from "./audioSettings";
import { TournamentMusicScene } from "./TournamentMusicScene";

vi.mock("phaser", () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
    Sound: { Events: { UNLOCKED: "unlocked" } },
  },
}));

function soundDouble() {
  return {
    play: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
  };
}

function setup() {
  let volume = 0.6;
  let settingsListener: (() => void) | null = null;
  const unsubscribe = vi.fn();
  const settings: AudioSettingsStore = {
    getState: vi.fn(() => ({ muted: false, volume })),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    toggleMute: vi.fn(),
    getEffectiveVolume: vi.fn(() => volume),
    subscribe: vi.fn((listener) => {
      settingsListener = listener;
      return unsubscribe;
    }),
  };
  const endSound = soundDouble();
  const epicSound = soundDouble();
  const add = vi.fn((key: string) => (key === AUDIO_KEYS.END ? endSound : epicSound));
  const scene = new TournamentMusicScene(settings);

  Object.defineProperty(scene, "sound", {
    value: { locked: false, add, once: vi.fn() },
    configurable: true,
  });
  Object.defineProperty(scene, "events", {
    value: { once: vi.fn() },
    configurable: true,
  });

  return {
    scene,
    add,
    endSound,
    epicSound,
    unsubscribe,
    changeVolume(next: number) {
      volume = next;
      settingsListener?.();
    },
  };
}

describe("TournamentMusicScene", () => {
  it("starts a queued track once and keeps it looping", () => {
    const { scene, add, endSound } = setup();
    scene.setTrack(AUDIO_KEYS.END);
    scene.create();
    scene.setTrack(AUDIO_KEYS.END);

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(AUDIO_KEYS.END, { loop: true, volume: 0.6 });
    expect(endSound.play).toHaveBeenCalledTimes(1);
  });

  it("stops the previous loop when the selected track changes", () => {
    const { scene, endSound, epicSound } = setup();
    scene.create();
    scene.setTrack(AUDIO_KEYS.END);
    scene.setTrack(AUDIO_KEYS.EPIC);

    expect(endSound.stop).toHaveBeenCalledTimes(1);
    expect(epicSound.play).toHaveBeenCalledTimes(1);
  });

  it("applies live volume changes without restarting the track", () => {
    const { scene, add, endSound, changeVolume } = setup();
    scene.create();
    scene.setTrack(AUDIO_KEYS.END);
    changeVolume(0);

    expect(endSound.setVolume).toHaveBeenLastCalledWith(0);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("stops music and unsubscribes on shutdown", () => {
    const { scene, endSound, unsubscribe } = setup();
    scene.create();
    scene.setTrack(AUDIO_KEYS.END);
    scene.shutdown();

    expect(endSound.stop).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
