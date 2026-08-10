import { describe, expect, it } from "vitest";
import { DEFAULT_TERRAIN_STYLE_KEY, TERRAIN_STYLE_REGISTRY } from "./terrainStyleRegistry";

describe("TERRAIN_STYLE_REGISTRY", () => {
  it("has 'default' with no tint (original terrain look)", () => {
    expect(TERRAIN_STYLE_REGISTRY.default).toBeDefined();
    expect(TERRAIN_STYLE_REGISTRY.default.tint).toBeUndefined();
  });

  it("has 'night' with a dark tint color", () => {
    expect(TERRAIN_STYLE_REGISTRY.night).toBeDefined();
    expect(typeof TERRAIN_STYLE_REGISTRY.night.tint).toBe("number");
  });

  it("uses 'default' as the default terrain style key", () => {
    expect(DEFAULT_TERRAIN_STYLE_KEY).toBe("default");
  });

  it("has 'underground' with a frame set and a blue tint", () => {
    expect(TERRAIN_STYLE_REGISTRY.underground).toBeDefined();
    const frames = TERRAIN_STYLE_REGISTRY.underground.frames;
    expect(frames).toBeDefined();
    const TILESET_TILE_COUNT = 22 * 11;
    for (const index of Object.values(frames ?? {})) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(TILESET_TILE_COUNT);
    }

    const tint = TERRAIN_STYLE_REGISTRY.underground.tint;
    expect(typeof tint).toBe("number");
    // Typecast ist hier sicher: wir haben oben typeof number geprüft.
    const safeTint = tint as number;
    // Sanity: vermeide versehentliche NaN/Infinity-Werte.
    expect(Number.isFinite(safeTint)).toBe(true);
    const r = (safeTint >> 16) & 0xff;
    const g = (safeTint >> 8) & 0xff;
    const b = safeTint & 0xff;
    expect(b > r && b > g, `expected a blue-ish tint, got RGB(${r}, ${g}, ${b})`).toBe(true);
  });
});
