import { describe, expect, it } from "vitest";
import { isValidLevelId, LEVEL_IDS } from "./levels";

describe("LEVEL_IDS", () => {
  it("enthält alle gültigen Level-IDs in fester Reihenfolge", () => {
    expect(LEVEL_IDS).toEqual([
      "level-one",
      "level-two",
      "level-three",
      "level-four",
      "level-five",
      "level-six",
      "toolkit-test",
    ]);
  });
});

describe("isValidLevelId", () => {
  it.each(LEVEL_IDS)("akzeptiert die bekannte ID '%s'", (id) => {
    expect(isValidLevelId(id)).toBe(true);
  });

  it.each(["unknown", ""])("lehnt die unbekannte ID '%s' ab", (id) => {
    expect(isValidLevelId(id)).toBe(false);
  });

  it.each([null, undefined, 42, {}, ["level-one"]])(
    "lehnt den Nicht-String-Wert %p ab",
    (value) => {
      expect(isValidLevelId(value)).toBe(false);
    }
  );
});
