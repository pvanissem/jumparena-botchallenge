/**
 * Sichtbare Terrain-Geometrie für den Bot-State (`state.platforms`) – siehe
 * `.features/bot-toolkit/design.md`, US-2. Bildet exakte Rechteck-Geometrie
 * (keine Rasterung) aus `level.platforms` + ungelösten `level.hiddenCoinBlocks`
 * ab, gefiltert auf den Sichtradius des Bots. Pure Funktion, keine
 * Phaser-Abhängigkeit.
 */
import type { PlatformKind, VisiblePlatform } from "@arena/bot-contract";
import { STATIC_IMAGE_KEYS, spriteScale } from "../assets/spriteSheets";
import { TILE_SIZE } from "../level/tiles";
import type { HiddenCoinBlockDef, LevelDef, PlatformDef } from "../level/types";
import { VIEW_RADIUS_PX } from "./viewport";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Kürzeste Distanz (quadriert) zwischen Kreismittelpunkt und Rechteck <= radius^2? */
function rectIntersectsCircle(rect: Rect, cx: number, cy: number, radius: number): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
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
  botY: number
): VisiblePlatform {
  return {
    dx: rect.x - botX,
    dy: rect.y - botY,
    width: rect.width,
    height: rect.height,
    kind,
  };
}

export function buildVisiblePlatforms(
  level: LevelDef,
  resolvedBlockIds: ReadonlySet<string>,
  botX: number,
  botY: number,
  radius = VIEW_RADIUS_PX
): VisiblePlatform[] {
  const result: VisiblePlatform[] = [];

  for (const platform of level.platforms) {
    if (platform.tilesWide <= 0) continue;
    const rect = platformRect(platform);
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (!rectIntersectsCircle(rect, botX, botY, radius)) continue;
    result.push(toVisiblePlatform(rect, platform.kind ?? "ground", botX, botY));
  }

  for (const block of level.hiddenCoinBlocks) {
    if (resolvedBlockIds.has(block.id)) continue;
    const rect = blockRect(block);
    if (!rectIntersectsCircle(rect, botX, botY, radius)) continue;
    result.push(toVisiblePlatform(rect, "block", botX, botY));
  }

  return result;
}
