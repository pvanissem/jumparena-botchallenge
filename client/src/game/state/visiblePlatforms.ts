/**
 * Sichtbare Terrain-Geometrie für den Bot-State (`state.platforms`) – siehe
 * `.features/bot-toolkit/design.md`, US-2. Bildet exakte Rechteck-Geometrie
 * (keine Rasterung) aus `level.platforms` + verbleibenden `level.hiddenCoinBlocks`
 * ab, gefiltert auf das Sichtrechteck des Bots (siehe `viewport.ts`). Pure
 * Funktion, keine Phaser-Abhängigkeit.
 */
import type { PlatformKind, VisiblePlatform } from "@arena/bot-contract";
import { STATIC_IMAGE_KEYS, spriteScale } from "../assets/spriteSheets";
import { TILE_SIZE } from "../level/tiles";
import type { HiddenCoinBlockDef, LevelDef, PlatformDef } from "../level/types";
import { VIEW_HALF_HEIGHT_PX, VIEW_HALF_WIDTH_PX } from "./viewport";
import type { WorldRect } from "./worldSnapshot";

export type ObservedPlatform = VisiblePlatform & {
  id: string;
  collision: "solid" | "one-way-up";
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Überlappt das Rechteck das um (cx, cy) zentrierte Sichtrechteck?
 *  Klassischer AABB-Test, Berührung an der Kante zählt als sichtbar. */
export function rectIntersectsView(
  rect: Rect,
  cx: number,
  cy: number,
  halfWidth: number,
  halfHeight: number
): boolean {
  return (
    rect.x <= cx + halfWidth &&
    rect.x + rect.width >= cx - halfWidth &&
    rect.y <= cy + halfHeight &&
    rect.y + rect.height >= cy - halfHeight
  );
}

function platformRect(platform: PlatformDef): Rect {
  // Die tatsächliche Kollisionsfläche entspricht dem in `worldBuilder`
  // erzeugten StaticBody: Mittelpunkt bei `y + TILE_SIZE/2`, Höhe `TILE_SIZE`
  // -> Oberkante liegt EXAKT bei `platform.y`. Bewusst NICHT auf die Tile-Zeile
  // gerundet (`floor(y/16)*16`): das wäre bei nicht-tile-alignten Plattformen
  // (z.B. y=500) um bis zu 15px daneben und verfälscht jede Landevorhersage.
  return {
    x: platform.x,
    y: platform.y,
    width: platform.tilesWide * TILE_SIZE,
    height: TILE_SIZE,
  };
}

const BLOCK_SCALE = spriteScale(STATIC_IMAGE_KEYS.BLOCK_IDLE);
const BLOCK_WIDTH = 28 * BLOCK_SCALE;
const BLOCK_HEIGHT = 24 * BLOCK_SCALE;

function blockRect(block: HiddenCoinBlockDef): Rect {
  return {
    x: block.x - BLOCK_WIDTH / 2,
    y: block.y - BLOCK_HEIGHT / 2,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
  };
}

function toVisiblePlatform(
  rect: Rect,
  kind: PlatformKind,
  botX: number,
  botY: number,
  id: string
): ObservedPlatform {
  return {
    id,
    collision: kind === "float" ? "one-way-up" : "solid",
    dx: rect.x - botX,
    dy: rect.y - botY,
    width: rect.width,
    height: rect.height,
    kind,
  };
}

export function buildVisiblePlatforms(
  level: LevelDef,
  _resolvedBlockIds: ReadonlySet<string>,
  botX: number,
  botY: number,
  halfWidth = VIEW_HALF_WIDTH_PX,
  halfHeight = VIEW_HALF_HEIGHT_PX,
  levelId = "level",
  blocks?: readonly { id: string; bounds: WorldRect }[]
): ObservedPlatform[] {
  const result: ObservedPlatform[] = [];

  for (const [index, platform] of level.platforms.entries()) {
    if (platform.tilesWide <= 0) continue;
    const rect = platformRect(platform);
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (!rectIntersectsView(rect, botX, botY, halfWidth, halfHeight)) continue;
    result.push(
      toVisiblePlatform(rect, platform.kind ?? "ground", botX, botY, `${levelId}:platform:${index}`)
    );
  }

  for (const block of blocks ??
    level.hiddenCoinBlocks.map((block) => ({ id: block.id, bounds: blockRect(block) }))) {
    const rect = block.bounds;
    if (!rectIntersectsView(rect, botX, botY, halfWidth, halfHeight)) continue;
    result.push(toVisiblePlatform(rect, "block", botX, botY, block.id));
  }

  return result;
}
