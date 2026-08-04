import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioSettingsStore } from "./audioSettings";

function createMockStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null),
    get length() {
      return data.size;
    },
  } as unknown as Storage;
}

describe("createAudioSettingsStore", () => {
  it("returns the default state when storage has no entry", () => {
    const store = createAudioSettingsStore(createMockStorage());
    expect(store.getState()).toEqual({ muted: false, volume: 0.6 });
  });

  describe("setVolume", () => {
    it("clamps values below 0 to 0", () => {
      const store = createAudioSettingsStore(createMockStorage());
      store.setVolume(-0.5);
      expect(store.getState().volume).toBe(0);
    });

    it("clamps values above 1 to 1", () => {
      const store = createAudioSettingsStore(createMockStorage());
      store.setVolume(1.5);
      expect(store.getState().volume).toBe(1);
    });

    it("accepts values within range unchanged", () => {
      const store = createAudioSettingsStore(createMockStorage());
      store.setVolume(0.3);
      expect(store.getState().volume).toBe(0.3);
    });
  });

  describe("setMuted / toggleMute", () => {
    it("setMuted sets the muted flag", () => {
      const store = createAudioSettingsStore(createMockStorage());
      store.setMuted(true);
      expect(store.getState().muted).toBe(true);
      store.setMuted(false);
      expect(store.getState().muted).toBe(false);
    });

    it("toggleMute flips the muted flag", () => {
      const store = createAudioSettingsStore(createMockStorage());
      expect(store.getState().muted).toBe(false);
      store.toggleMute();
      expect(store.getState().muted).toBe(true);
      store.toggleMute();
      expect(store.getState().muted).toBe(false);
    });
  });

  describe("getEffectiveVolume", () => {
    it("returns 0 when muted, regardless of volume", () => {
      const store = createAudioSettingsStore(createMockStorage());
      store.setVolume(0.8);
      store.setMuted(true);
      expect(store.getEffectiveVolume()).toBe(0);
    });

    it("returns the volume when not muted", () => {
      const store = createAudioSettingsStore(createMockStorage());
      store.setVolume(0.8);
      expect(store.getEffectiveVolume()).toBe(0.8);
    });
  });

  describe("subscribe", () => {
    it("notifies the listener exactly once per change", () => {
      const store = createAudioSettingsStore(createMockStorage());
      const listener = vi.fn();
      store.subscribe(listener);

      store.setVolume(0.2);
      expect(listener).toHaveBeenCalledTimes(1);

      store.setMuted(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("stops notifying after unsubscribe", () => {
      const store = createAudioSettingsStore(createMockStorage());
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      store.setVolume(0.2);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("persistence", () => {
    it("writes changes to the given storage under a fixed key", () => {
      const storage = createMockStorage();
      const store = createAudioSettingsStore(storage);

      store.setVolume(0.4);
      store.setMuted(true);

      expect(storage.setItem).toHaveBeenLastCalledWith(
        "coin-quest-arena:audio-settings",
        JSON.stringify({ muted: true, volume: 0.4 })
      );
    });

    it("a new store instance reads back persisted state from the same storage", () => {
      const storage = createMockStorage();
      const first = createAudioSettingsStore(storage);
      first.setVolume(0.9);
      first.setMuted(true);

      const second = createAudioSettingsStore(storage);
      expect(second.getState()).toEqual({ muted: true, volume: 0.9 });
    });
  });

  describe("error handling", () => {
    it("stays functional when storage.getItem throws", () => {
      const throwingStorage = {
        getItem: vi.fn(() => {
          throw new Error("blocked");
        }),
        setItem: vi.fn(),
      } as unknown as Storage;

      const store = createAudioSettingsStore(throwingStorage);
      expect(store.getState()).toEqual({ muted: false, volume: 0.6 });
    });

    it("stays functional when storage.setItem throws", () => {
      const throwingStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error("blocked");
        }),
      } as unknown as Storage;

      const store = createAudioSettingsStore(throwingStorage);
      expect(() => store.setVolume(0.5)).not.toThrow();
      expect(store.getState().volume).toBe(0.5);
    });
  });
});

describe("createAudioSettingsStore without an explicit storage argument", () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  });

  it("falls back to in-memory defaults when window.localStorage is unavailable", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("no localStorage in this environment");
      },
    });

    expect(() => createAudioSettingsStore()).not.toThrow();
    const store = createAudioSettingsStore();
    expect(store.getState()).toEqual({ muted: false, volume: 0.6 });

    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    }
  });
});
