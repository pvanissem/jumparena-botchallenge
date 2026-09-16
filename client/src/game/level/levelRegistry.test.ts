import { LEVEL_IDS } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { LEVEL_FIVE } from "./levelFive";
import { LEVEL_FOUR } from "./levelFour";
import { LEVEL_ONE } from "./levelOne";
import { DEFAULT_LEVEL_ID, getLevelById, LEVEL_REGISTRY } from "./levelRegistry";
import { LEVEL_SIX } from "./levelSix";
import { LEVEL_THREE } from "./levelThree";
import { LEVEL_TWO } from "./levelTwo";

describe("LEVEL_REGISTRY", () => {
  it("contains level-one through level-six with human-readable labels", () => {
    const ids = LEVEL_REGISTRY.map((entry) => entry.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "level-one",
        "level-two",
        "level-three",
        "level-four",
        "level-five",
        "level-six",
        "toolkit-test",
      ])
    );
    for (const entry of LEVEL_REGISTRY) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("has level-one as the default level id", () => {
    expect(DEFAULT_LEVEL_ID).toBe("level-one");
  });

  it("enthält zu jeder ID aus LEVEL_IDS einen Registry-Eintrag", () => {
    for (const id of LEVEL_IDS) {
      expect(() => getLevelById(id)).not.toThrow();
    }
  });

  it("enthält keine ID, die nicht in LEVEL_IDS enthalten ist", () => {
    const levelIdSet = new Set(LEVEL_IDS as readonly string[]);
    for (const entry of LEVEL_REGISTRY) {
      expect(levelIdSet.has(entry.id)).toBe(true);
    }
  });
});

describe("getLevelById", () => {
  it("does not include an additional visitor level", () => {
    expect(() => getLevelById("level-messe")).toThrow();
    expect(getLevelById(DEFAULT_LEVEL_ID)).toBe(LEVEL_ONE);
    expect(new Set(LEVEL_REGISTRY.map((entry) => entry.id)).size).toBe(LEVEL_REGISTRY.length);
  });

  it("returns LEVEL_ONE for 'level-one'", () => {
    expect(getLevelById("level-one")).toBe(LEVEL_ONE);
  });

  it("returns LEVEL_TWO for 'level-two'", () => {
    expect(getLevelById("level-two")).toBe(LEVEL_TWO);
  });

  it("returns LEVEL_THREE for 'level-three'", () => {
    expect(getLevelById("level-three")).toBe(LEVEL_THREE);
  });

  it("returns LEVEL_FOUR for 'level-four'", () => {
    expect(getLevelById("level-four")).toBe(LEVEL_FOUR);
  });

  it("returns LEVEL_FIVE for 'level-five'", () => {
    expect(getLevelById("level-five")).toBe(LEVEL_FIVE);
  });

  it("returns LEVEL_SIX for 'level-six'", () => {
    expect(getLevelById("level-six")).toBe(LEVEL_SIX);
  });

  it("throws a clear error for an unknown level id", () => {
    expect(() => getLevelById("does-not-exist")).toThrow(/does-not-exist/);
  });
});
