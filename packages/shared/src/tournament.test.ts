import { describe, expect, it } from "vitest";
import {
  ALLOWED_GROUP_SIZES,
  DEFAULT_GROUP_SIZE,
  DEFAULT_LIVES_PER_RUN,
  estimateRoundCount,
  isValidGroupSize,
  isValidLivesPerRun,
  MAX_LIVES_PER_RUN,
  MIN_LIVES_PER_RUN,
  resolveStageLevelId,
} from "./tournament";

describe("Leben-Konstanten", () => {
  it("spannt den Bereich 1..99 mit Default 3 auf", () => {
    expect(MIN_LIVES_PER_RUN).toBe(1);
    expect(MAX_LIVES_PER_RUN).toBe(99);
    expect(DEFAULT_LIVES_PER_RUN).toBe(3);
  });

  it("hat einen Default innerhalb der Grenzen", () => {
    expect(isValidLivesPerRun(DEFAULT_LIVES_PER_RUN)).toBe(true);
  });
});

describe("Gruppengrößen", () => {
  it("erlaubt nur 2 und 4 mit Default 4", () => {
    expect(ALLOWED_GROUP_SIZES).toEqual([2, 4]);
    expect(DEFAULT_GROUP_SIZE).toBe(4);
    expect(isValidGroupSize(DEFAULT_GROUP_SIZE)).toBe(true);
  });
});

describe("isValidLivesPerRun", () => {
  it.each([1, 2, 3, 50, 99])("akzeptiert %i", (value) => {
    expect(isValidLivesPerRun(value)).toBe(true);
  });

  it.each([0, -1, 100, 1000])("lehnt den Wert %i ausserhalb der Grenzen ab", (value) => {
    expect(isValidLivesPerRun(value)).toBe(false);
  });

  it("lehnt nicht-ganzzahlige Werte ab", () => {
    expect(isValidLivesPerRun(2.5)).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "lehnt den Sonderwert %p ab",
    (value) => {
      expect(isValidLivesPerRun(value)).toBe(false);
    }
  );

  it.each(["3", null, undefined, {}, []])("lehnt den Nicht-Zahlwert %p ab", (value) => {
    expect(isValidLivesPerRun(value)).toBe(false);
  });
});

describe("isValidGroupSize", () => {
  it.each([2, 4])("akzeptiert %i", (value) => {
    expect(isValidGroupSize(value)).toBe(true);
  });

  it.each([1, 3, 5, 8, 0, -2])("lehnt den Wert %i ausserhalb der erlaubten Werte ab", (value) => {
    expect(isValidGroupSize(value)).toBe(false);
  });

  it("lehnt nicht-ganzzahlige Werte ab", () => {
    expect(isValidGroupSize(2.5)).toBe(false);
  });

  it.each(["4", null, undefined, {}, []])("lehnt den Nicht-Zahlwert %p ab", (value) => {
    expect(isValidGroupSize(value)).toBe(false);
  });
});

describe("resolveStageLevelId", () => {
  it("wählt für Index 0 die erste Stage", () => {
    expect(resolveStageLevelId(["level-one", "level-two"], 0)).toBe("level-one");
  });

  it("wählt für Index 1 die zweite Stage", () => {
    expect(resolveStageLevelId(["level-one", "level-two"], 1)).toBe("level-two");
  });

  it("klemmt auf die letzte Stage, wenn der Index über die Liste hinausgeht", () => {
    expect(resolveStageLevelId(["level-one", "level-two"], 5)).toBe("level-two");
  });

  it("gibt bei einer Ein-Element-Liste immer dieses Level zurück", () => {
    expect(resolveStageLevelId(["level-one"], 0)).toBe("level-one");
    expect(resolveStageLevelId(["level-one"], 42)).toBe("level-one");
  });

  it("wirft bei leerer Stage-Liste", () => {
    expect(() => resolveStageLevelId([], 0)).toThrow(/stageLevelIds/);
  });
});

describe("estimateRoundCount", () => {
  it("berechnet 4 Bots in Gruppen zu 4 als eine Runde", () => {
    expect(estimateRoundCount(4, 4)).toBe(1);
  });

  it("berechnet 8 Bots in Gruppen zu 4 als zwei Runden", () => {
    expect(estimateRoundCount(8, 4)).toBe(2);
  });

  it("berechnet 16 Bots in Gruppen zu 4 als zwei Runden", () => {
    expect(estimateRoundCount(16, 4)).toBe(2);
  });

  it("berechnet 4 Bots in Gruppen zu 2 als zwei Runden", () => {
    expect(estimateRoundCount(4, 2)).toBe(2);
  });

  it("berechnet 3 Bots in Gruppen zu 2 mit Freilos als zwei Runden", () => {
    expect(estimateRoundCount(3, 2)).toBe(2);
  });

  it("berechnet 2 Bots als eine Runde", () => {
    expect(estimateRoundCount(2, 4)).toBe(1);
  });

  it("gibt für weniger als zwei Teilnehmer 0 zurück", () => {
    expect(estimateRoundCount(1, 4)).toBe(0);
    expect(estimateRoundCount(0, 4)).toBe(0);
  });
});
