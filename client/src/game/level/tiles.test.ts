import { describe, expect, it } from "vitest";
import { buildDynamicTileState, buildNearbyTiles, tileTypeAt } from "./tiles";
import type { LevelDef } from "./types";

const TILE_SIZE = 16;

function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    worldWidth: 320,
    worldHeight: 200,
    groundY: 160,
    spawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    platforms: [],
    coins: [],
    hiddenCoinBlocks: [],
    checkpoints: [],
    hazards: [],
    utilities: [],
    ...overrides,
  };
}

const NO_DYNAMIC = { activeHazardIds: new Set<string>(), resolvedBlockIds: new Set<string>() };

describe("tileTypeAt", () => {
  it("returns 'solid' for a tile inside a platform segment", () => {
    const level = makeLevel({ platforms: [{ x: 0, y: 160, tilesWide: 4 }] });
    // platform spans col 0..3 at row 160/16=10
    expect(tileTypeAt(level, 1, 10, NO_DYNAMIC)).toBe("solid");
  });

  it("returns 'empty' for a tile outside any platform", () => {
    const level = makeLevel({ platforms: [{ x: 0, y: 160, tilesWide: 4 }] });
    expect(tileTypeAt(level, 20, 0, NO_DYNAMIC)).toBe("empty");
  });

  it("returns 'hazard' for an active hazard tile", () => {
    const level = makeLevel({
      hazards: [{ kind: "stachlinger", id: "h1", x: 32, y: 16 }],
    });
    const dynamic = { activeHazardIds: new Set(["h1"]), resolvedBlockIds: new Set<string>() };
    expect(tileTypeAt(level, 32 / TILE_SIZE, 16 / TILE_SIZE, dynamic)).toBe("hazard");
  });

  it("does not return 'hazard' for an inactive hazard tile", () => {
    const level = makeLevel({
      hazards: [{ kind: "loderix", id: "h1", x: 32, y: 16 }],
    });
    expect(tileTypeAt(level, 32 / TILE_SIZE, 16 / TILE_SIZE, NO_DYNAMIC)).toBe("empty");
  });

  it("returns 'coinBlock' for an unresolved hidden block", () => {
    const level = makeLevel({
      hiddenCoinBlocks: [{ id: "b1", x: 48, y: 16, fruit: "kiwi" }],
    });
    expect(tileTypeAt(level, 48 / TILE_SIZE, 16 / TILE_SIZE, NO_DYNAMIC)).toBe("coinBlock");
  });

  it("does not return 'coinBlock' for a resolved hidden block", () => {
    const level = makeLevel({
      hiddenCoinBlocks: [{ id: "b1", x: 48, y: 16, fruit: "kiwi" }],
    });
    const dynamic = { activeHazardIds: new Set<string>(), resolvedBlockIds: new Set(["b1"]) };
    expect(tileTypeAt(level, 48 / TILE_SIZE, 16 / TILE_SIZE, dynamic)).toBe("empty");
  });

  it("returns 'goal' for the goal tile", () => {
    const level = makeLevel({ goal: { x: 64, y: 16 } });
    expect(tileTypeAt(level, 64 / TILE_SIZE, 16 / TILE_SIZE, NO_DYNAMIC)).toBe("goal");
  });

  it("prioritizes an active hazard over a coinBlock/goal at the same position", () => {
    const level = makeLevel({
      goal: { x: 48, y: 16 },
      hiddenCoinBlocks: [{ id: "b1", x: 48, y: 16, fruit: "kiwi" }],
      hazards: [{ kind: "stachlinger", id: "h1", x: 48, y: 16 }],
    });
    const dynamic = { activeHazardIds: new Set(["h1"]), resolvedBlockIds: new Set<string>() };
    expect(tileTypeAt(level, 48 / TILE_SIZE, 16 / TILE_SIZE, dynamic)).toBe("hazard");
  });
});

describe("buildNearbyTiles", () => {
  it("returns a grid of the requested dimensions centered on the racer", () => {
    const level = makeLevel({ platforms: [{ x: 0, y: 160, tilesWide: 20 }] });
    const grid = buildNearbyTiles(level, NO_DYNAMIC, 10, 9, 7, 5);
    expect(grid.length).toBe(5);
    for (const row of grid) {
      expect(row.length).toBe(7);
    }
    // center cell (row 2, col 3) corresponds to (centerCol, centerRow) = (10,9)
    expect(grid[2][3]).toBe(tileTypeAt(level, 10, 9, NO_DYNAMIC));
  });
});

describe("buildDynamicTileState", () => {
  const level = makeLevel({
    hazards: [
      { kind: "schnetzler", id: "saw-1", x: 0, y: 0, minX: 0, maxX: 100, speed: 10 },
      { kind: "stachlinger", id: "spike-1", x: 0, y: 0 },
      { kind: "kugelblitz", id: "ball-1", pivotX: 0, pivotY: 0, length: 10 },
      { kind: "loderix", id: "fire-1", x: 0, y: 0, onMs: 1000, offMs: 1000, phaseMs: 0 },
    ],
  });

  it("marks always-dangerous hazard kinds (schnetzler/stachlinger/kugelblitz) as always active", () => {
    const dynamic = buildDynamicTileState(level, { resolvedBlockIds: new Set() } as never, 0);
    expect(dynamic.activeHazardIds.has("saw-1")).toBe(true);
    expect(dynamic.activeHazardIds.has("spike-1")).toBe(true);
    expect(dynamic.activeHazardIds.has("ball-1")).toBe(true);
  });

  it("derives loderix's active state from isTimedActive", () => {
    const activeState = buildDynamicTileState(level, { resolvedBlockIds: new Set() } as never, 500);
    expect(activeState.activeHazardIds.has("fire-1")).toBe(true);

    const inactiveState = buildDynamicTileState(
      level,
      { resolvedBlockIds: new Set() } as never,
      1500
    );
    expect(inactiveState.activeHazardIds.has("fire-1")).toBe(false);
  });

  it("derives resolvedBlockIds 1:1 from racer.resolvedBlockIds", () => {
    const resolved = new Set(["block-x"]);
    const dynamic = buildDynamicTileState(level, { resolvedBlockIds: resolved } as never, 0);
    expect(dynamic.resolvedBlockIds).toEqual(resolved);
  });
});
