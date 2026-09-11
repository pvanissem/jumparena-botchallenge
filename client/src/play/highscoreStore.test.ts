import { describe, expect, it } from "vitest";
import type { HighscoreEntry } from "./highscore";
import {
  createHighscoreStore,
  HIGHSCORE_STORAGE_KEY,
  HIGHSCORE_STORAGE_LIMIT,
} from "./highscoreStore";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    read: (key: string) => data.get(key) ?? null,
  };
}

function entry(overrides: Partial<HighscoreEntry> = {}): HighscoreEntry {
  return { id: "a", name: "MAX", score: 100, levelsCompleted: 1, createdAt: 1, ...overrides };
}

describe("highscoreStore", () => {
  it("startet mit einer leeren Liste", () => {
    expect(createHighscoreStore(fakeStorage()).load()).toEqual([]);
  });

  it("speichert Einträge und liest sie wieder", () => {
    const store = createHighscoreStore(fakeStorage());
    store.save([entry()]);
    expect(store.load()).toEqual([entry()]);
  });

  it("überlebt einen Reload (neue Instanz auf demselben Storage)", () => {
    const storage = fakeStorage();
    createHighscoreStore(storage).save([entry({ id: "x", score: 42 })]);
    expect(createHighscoreStore(storage).load()[0].score).toBe(42);
  });

  it("gibt die Liste sortiert zurück", () => {
    const store = createHighscoreStore(fakeStorage());
    store.save([entry({ id: "a", score: 10 }), entry({ id: "b", score: 900 })]);
    expect(store.load().map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("begrenzt die gespeicherte Liste", () => {
    const store = createHighscoreStore(fakeStorage());
    const many = Array.from({ length: HIGHSCORE_STORAGE_LIMIT + 15 }, (_, index) =>
      entry({ id: `e${index}`, score: index })
    );
    store.save(many);
    expect(store.load()).toHaveLength(HIGHSCORE_STORAGE_LIMIT);
  });

  it("behält beim Begrenzen die besten Einträge", () => {
    const store = createHighscoreStore(fakeStorage());
    const many = Array.from({ length: HIGHSCORE_STORAGE_LIMIT + 5 }, (_, index) =>
      entry({ id: `e${index}`, score: index })
    );
    store.save(many);
    expect(store.load()[0].score).toBe(HIGHSCORE_STORAGE_LIMIT + 4);
  });

  it("schreibt ein Versionsfeld", () => {
    const storage = fakeStorage();
    createHighscoreStore(storage).save([entry()]);
    expect(JSON.parse(storage.read(HIGHSCORE_STORAGE_KEY) as string).version).toBe(1);
  });

  it("fällt bei kaputtem JSON auf eine leere Liste zurück", () => {
    const store = createHighscoreStore(fakeStorage({ [HIGHSCORE_STORAGE_KEY]: "{{{" }));
    expect(store.load()).toEqual([]);
  });

  it("ignoriert Daten mit unbekannter Version", () => {
    const raw = JSON.stringify({ version: 42, entries: [entry()] });
    expect(createHighscoreStore(fakeStorage({ [HIGHSCORE_STORAGE_KEY]: raw })).load()).toEqual([]);
  });

  it("ignoriert Einträge mit fehlenden Feldern", () => {
    const raw = JSON.stringify({ version: 1, entries: [{ name: "X" }, entry()] });
    expect(createHighscoreStore(fakeStorage({ [HIGHSCORE_STORAGE_KEY]: raw })).load()).toHaveLength(
      1
    );
  });

  it("bleibt ohne verfügbares Storage funktionsfähig", () => {
    const store = createHighscoreStore(null);
    expect(() => store.save([entry()])).not.toThrow();
    expect(store.load()).toEqual([]);
  });

  it("bleibt funktionsfähig, wenn das Storage beim Schreiben wirft", () => {
    const store = createHighscoreStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    });
    expect(() => store.save([entry()])).not.toThrow();
  });

  it("leert die Liste auf Wunsch (Zurücksetzen am Stand)", () => {
    const store = createHighscoreStore(fakeStorage());
    store.save([entry()]);
    store.clear();
    expect(store.load()).toEqual([]);
  });
});
