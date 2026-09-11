import { describe, expect, it, vi } from "vitest";
import type { AudioSettingsStore } from "../game/audio/audioSettings";
import { PLAY_MUSIC_KEYS } from "./musicPlaylist";
import { PLAY_ASSETS_READY, PlayBootScene } from "./PlayBootScene";

vi.mock("phaser", () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
    Sound: { Events: { UNLOCKED: "unlocked", COMPLETE: "complete" } },
  },
}));

vi.mock("../game/assets/preloadArenaAssets", () => ({ preloadArenaAssets: vi.fn() }));

function setup({ locked = false }: { locked?: boolean } = {}) {
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

  /** Jeder Titel bekommt ein eigenes Sound-Objekt – so lässt sich prüfen,
   *  welcher Schlüssel wann gespielt wurde. */
  const played: string[] = [];
  const completeHandlers: (() => void)[] = [];
  const music = {
    play: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    destroy: vi.fn(),
    once: vi.fn((_event: string, handler: () => void) => completeHandlers.push(handler)),
  };
  const add = vi.fn((key: string) => {
    played.push(key);
    return music;
  });
  const soundOnce = vi.fn();
  const emit = vi.fn();
  const scene = new PlayBootScene(settings);

  Object.defineProperty(scene, "sound", {
    value: { locked, add, once: soundOnce },
    configurable: true,
  });
  Object.defineProperty(scene, "game", { value: { events: { emit } }, configurable: true });
  Object.defineProperty(scene, "events", { value: { once: vi.fn() }, configurable: true });

  return {
    scene,
    add,
    music,
    played,
    emit,
    soundOnce,
    unsubscribe,
    finishTrack() {
      completeHandlers.pop()?.();
    },
    changeVolume(next: number) {
      volume = next;
      settingsListener?.();
    },
  };
}

describe("PlayBootScene", () => {
  it("meldet geladene Assets über ein Event", () => {
    const { scene, emit } = setup();
    scene.create();
    expect(scene.assetsReady).toBe(true);
    expect(emit).toHaveBeenCalledWith(PLAY_ASSETS_READY);
  });

  it("startet genau einen Titel", () => {
    const { scene, add, music } = setup();
    scene.create();
    expect(add).toHaveBeenCalledTimes(1);
    expect(music.play).toHaveBeenCalledTimes(1);
  });

  it("spielt Titel einzeln statt in Endlosschleife (damit gemischt werden kann)", () => {
    const { scene, add } = setup();
    scene.create();
    expect(add).toHaveBeenCalledWith(expect.any(String), { loop: false, volume: 0.6 });
  });

  it("wählt den Titel aus der Musikliste", () => {
    const { scene, played } = setup();
    scene.create();
    expect(PLAY_MUSIC_KEYS).toContain(played[0]);
  });

  it("spielt nach dem Ende eines Titels den nächsten", () => {
    const { scene, played, finishTrack } = setup();
    scene.create();
    finishTrack();
    expect(played).toHaveLength(2);
    expect(played[1]).not.toBe(played[0]);
  });

  it("spielt jeden Titel einmal, bevor sich einer wiederholt", () => {
    const { scene, played, finishTrack } = setup();
    scene.create();
    for (let track = 1; track < PLAY_MUSIC_KEYS.length; track++) finishTrack();
    expect(new Set(played).size).toBe(PLAY_MUSIC_KEYS.length);
  });

  it("spielt nach dem Aufräumen nicht weiter", () => {
    const { scene, played, finishTrack } = setup();
    scene.create();
    scene.shutdown();
    finishTrack();
    expect(played).toHaveLength(1);
  });

  it("übernimmt Lautstärkeänderungen, ohne die Musik neu zu starten", () => {
    const { scene, add, music, changeVolume } = setup();
    scene.create();
    changeVolume(0);
    expect(music.setVolume).toHaveBeenLastCalledWith(0);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("wartet auf die Audio-Freigabe des Browsers, bevor Musik startet", () => {
    const { scene, add, soundOnce } = setup({ locked: true });
    scene.create();
    expect(add).not.toHaveBeenCalled();
    expect(soundOnce).toHaveBeenCalledWith("unlocked", expect.any(Function));
  });

  it("stoppt die Musik und meldet sich beim Aufräumen ab", () => {
    const { scene, music, unsubscribe } = setup();
    scene.create();
    scene.shutdown();
    expect(music.stop).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
