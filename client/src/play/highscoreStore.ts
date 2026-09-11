/**
 * Persistenz der Bestenliste – siehe `.features/play-mode/design.md`,
 * Abschnitt "Persistenz" (US-6). Muster wie `audioSettings.ts`:
 * injizierbares `StorageLike`, defensiv gegen fehlendes/kaputtes Storage.
 */
import { type HighscoreEntry, sortHighscores } from "./highscore";
import { type StorageLike, safeLocalStorage } from "./storage";

export const HIGHSCORE_STORAGE_KEY = "coin-quest-arena:play-highscores";
/** Mehr als angezeigt wird bewusst aufbewahrt (Statistik/Archiv am Stand). */
export const HIGHSCORE_STORAGE_LIMIT = 50;
const STORAGE_VERSION = 1;

export interface HighscoreStore {
  load(): HighscoreEntry[];
  save(entries: readonly HighscoreEntry[]): void;
  clear(): void;
}

function isEntry(value: unknown): value is HighscoreEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<HighscoreEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.score === "number" &&
    typeof entry.levelsCompleted === "number" &&
    typeof entry.createdAt === "number"
  );
}

export function createHighscoreStore(storage: StorageLike | null): HighscoreStore {
  function write(entries: readonly HighscoreEntry[]): void {
    if (!storage) return;
    try {
      const limited = sortHighscores(entries).slice(0, HIGHSCORE_STORAGE_LIMIT);
      storage.setItem(
        HIGHSCORE_STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, entries: limited })
      );
    } catch {
      // Storage blockiert – die Liste gilt dann nur für diese Sitzung.
    }
  }

  return {
    load() {
      if (!storage) return [];
      try {
        const raw = storage.getItem(HIGHSCORE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as { version?: number; entries?: unknown };
        if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return [];
        return sortHighscores(parsed.entries.filter(isEntry));
      } catch {
        return [];
      }
    },
    save: write,
    clear() {
      write([]);
    },
  };
}

export const highscoreStore: HighscoreStore = createHighscoreStore(safeLocalStorage());
