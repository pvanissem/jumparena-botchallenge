/**
 * Purer Audio-Settings-Store (Master-Lautstärke + Mute) – kein Phaser-/
 * React-Import, siehe `.features/game-audio/design.md`, Abschnitt
 * "audioSettings.ts". Factory statt direktem Modul-Singleton-Export, damit
 * Tests eine frische, isolierte Instanz erzeugen können (Dependency
 * Inversion/Testbarkeit); `audioSettings` unten ist die einzige Instanz, die
 * die Anwendung tatsächlich verwendet.
 */
export interface AudioSettingsState {
  muted: boolean;
  volume: number;
}

export interface AudioSettingsStore {
  getState(): AudioSettingsState;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  toggleMute(): void;
  getEffectiveVolume(): number;
  subscribe(listener: () => void): () => void;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "coin-quest-arena:audio-settings";
const DEFAULT_STATE: AudioSettingsState = { muted: false, volume: 0.6 };

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

function safeLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readPersistedState(storage: StorageLike | null): AudioSettingsState {
  if (!storage) return DEFAULT_STATE;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AudioSettingsState>;
    return {
      muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_STATE.muted,
      volume: typeof parsed.volume === "number" ? clampVolume(parsed.volume) : DEFAULT_STATE.volume,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writePersistedState(storage: StorageLike | null, state: AudioSettingsState): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage nicht verfügbar/blockiert (privater Modus etc.) – Store bleibt
    // in-memory funktionsfähig, siehe design.md "Fehlerbehandlung & Edge Cases".
  }
}

export function createAudioSettingsStore(
  storage: StorageLike | null = safeLocalStorage()
): AudioSettingsStore {
  let state: AudioSettingsState = readPersistedState(storage);
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function update(partial: Partial<AudioSettingsState>): void {
    state = { ...state, ...partial };
    writePersistedState(storage, state);
    notify();
  }

  return {
    getState: () => state,
    setVolume: (volume) => update({ volume: clampVolume(volume) }),
    setMuted: (muted) => update({ muted }),
    toggleMute: () => update({ muted: !state.muted }),
    getEffectiveVolume: () => (state.muted ? 0 : state.volume),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const audioSettings: AudioSettingsStore = createAudioSettingsStore();
