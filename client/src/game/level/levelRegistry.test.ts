import { describe, expect, it } from "vitest";
import { LEVEL_FOUR } from "./levelFour";
import { LEVEL_ONE } from "./levelOne";
import { DEFAULT_LEVEL_ID, getLevelById, LEVEL_REGISTRY } from "./levelRegistry";
import { LEVEL_THREE } from "./levelThree";
import { LEVEL_TWO } from "./levelTwo";

describe("LEVEL_REGISTRY", () => {
  it("contains level-one through level-four with human-readable labels", () => {
    const ids = LEVEL_REGISTRY.map((entry) => entry.id);
    expect(ids).toEqual(
      expect.arrayContaining(["level-one", "level-two", "level-three", "level-four"])
    );
    for (const entry of LEVEL_REGISTRY) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("has level-one as the default level id", () => {
    expect(DEFAULT_LEVEL_ID).toBe("level-one");
  });
});

describe("getLevelById", () => {
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

  it("throws a clear error for an unknown level id", () => {
    expect(() => getLevelById("does-not-exist")).toThrow(/does-not-exist/);
  });
});
