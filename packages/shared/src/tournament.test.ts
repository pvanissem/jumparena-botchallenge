import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVES_PER_RUN,
  isValidLivesPerRun,
  MAX_LIVES_PER_RUN,
  MIN_LIVES_PER_RUN,
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
