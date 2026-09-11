import { describe, expect, it } from "vitest";
import {
  HIGHSCORE_DISPLAY_SIZE,
  type HighscoreEntry,
  insertHighscore,
  sortHighscores,
} from "./highscore";

function entry(overrides: Partial<HighscoreEntry> = {}): HighscoreEntry {
  return {
    id: "id-1",
    name: "MAX",
    score: 100,
    levelsCompleted: 2,
    createdAt: 1_000,
    ...overrides,
  };
}

describe("sortHighscores", () => {
  it("sortiert absteigend nach Score", () => {
    const sorted = sortHighscores([
      entry({ id: "a", score: 50 }),
      entry({ id: "b", score: 300 }),
      entry({ id: "c", score: 120 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("sortiert bei Gleichstand den älteren Eintrag nach oben", () => {
    const sorted = sortHighscores([
      entry({ id: "neu", score: 100, createdAt: 2_000 }),
      entry({ id: "alt", score: 100, createdAt: 1_000 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["alt", "neu"]);
  });

  it("lässt die Eingabeliste unverändert", () => {
    const input = [entry({ id: "a", score: 1 }), entry({ id: "b", score: 2 })];
    sortHighscores(input);
    expect(input.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("insertHighscore", () => {
  it("nimmt einen Eintrag in eine leere Liste auf", () => {
    const result = insertHighscore([], entry());
    expect(result.entries).toHaveLength(1);
    expect(result.rank).toBe(1);
  });

  it("meldet die Platzierung des neuen Eintrags", () => {
    const existing = [entry({ id: "a", score: 500 }), entry({ id: "b", score: 100 })];
    const result = insertHighscore(existing, entry({ id: "neu", score: 300 }));
    expect(result.rank).toBe(2);
  });

  it("sortiert den neuen Eintrag korrekt ein", () => {
    const existing = [entry({ id: "a", score: 500 }), entry({ id: "b", score: 100 })];
    const result = insertHighscore(existing, entry({ id: "neu", score: 300 }));
    expect(result.entries.map((e) => e.id)).toEqual(["a", "neu", "b"]);
  });

  it("meldet bei Gleichstand den Platz hinter dem älteren Eintrag", () => {
    const existing = [entry({ id: "alt", score: 100, createdAt: 1_000 })];
    const result = insertHighscore(existing, entry({ id: "neu", score: 100, createdAt: 2_000 }));
    expect(result.rank).toBe(2);
  });

  it("liefert rank=null, wenn der Eintrag nicht in die Anzeige-Top-10 kommt", () => {
    const existing = Array.from({ length: HIGHSCORE_DISPLAY_SIZE }, (_, index) =>
      entry({ id: `e${index}`, score: 1_000 + index })
    );
    const result = insertHighscore(existing, entry({ id: "schwach", score: 5 }));
    expect(result.rank).toBeNull();
  });

  it("behält einen schwachen Eintrag dennoch in der Gesamtliste", () => {
    const existing = Array.from({ length: HIGHSCORE_DISPLAY_SIZE }, (_, index) =>
      entry({ id: `e${index}`, score: 1_000 + index })
    );
    const result = insertHighscore(existing, entry({ id: "schwach", score: 5 }));
    expect(result.entries.map((e) => e.id)).toContain("schwach");
  });

  it("verdrängt bei vollem Feld den schwächsten Eintrag aus der Anzeige", () => {
    const existing = Array.from({ length: HIGHSCORE_DISPLAY_SIZE }, (_, index) =>
      entry({ id: `e${index}`, score: 100 + index })
    );
    const result = insertHighscore(existing, entry({ id: "stark", score: 9_999 }));
    expect(result.rank).toBe(1);
    expect(result.entries.slice(0, HIGHSCORE_DISPLAY_SIZE).map((e) => e.id)).not.toContain("e0");
  });

  it("lässt die Ausgangsliste unverändert", () => {
    const existing = [entry({ id: "a", score: 500 })];
    insertHighscore(existing, entry({ id: "neu", score: 300 }));
    expect(existing).toHaveLength(1);
  });

  it("zeigt maximal zehn Einträge an", () => {
    expect(HIGHSCORE_DISPLAY_SIZE).toBe(10);
  });
});
