/**
 * Baut den `BotState`-Contract (`@arena/bot-contract`) aus einer `WorldSnapshot`
 * + `RacerRuntimeState` – siehe `.features/level-one-arena/design.md`,
 * Abschnitt "state/worldSnapshot.ts + botStateBuilder.ts".
 */
import type { BotState, NearestCoin, NearestHazard, NearestUtility } from "@arena/bot-contract";
import { buildNearbyTiles, TILE_SIZE } from "../level/tiles";
import type { RacerRuntimeState } from "../rules/racerState";
import type { WorldSnapshot } from "./worldSnapshot";

interface Positioned {
  x: number;
  y: number;
}

/** Findet das nächstgelegene Element (nach euklidischem Abstand) oder `null`. */
function nearestByDistance<T extends Positioned>(
  from: Positioned,
  candidates: readonly T[]
): T | null {
  let best: T | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dx = candidate.x - from.x;
    const dy = candidate.y - from.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = candidate;
    }
  }
  return best;
}

export function buildBotState(
  snapshot: WorldSnapshot,
  racer: RacerRuntimeState,
  tick: number
): BotState {
  const position = { x: racer.x, y: racer.y };

  const nearestCoin = toNearestCoin(position, snapshot.visibleCoins);
  const nearestHazard = toNearestHazard(position, snapshot.hazards);
  const nearestUtility = toNearestUtility(position, snapshot.utilities);

  const centerCol = Math.floor(racer.x / TILE_SIZE);
  const centerRow = Math.floor(racer.y / TILE_SIZE);
  const nearbyTiles = buildNearbyTiles(snapshot.level, snapshot.dynamic, centerCol, centerRow);

  const goalDirection = {
    dx: snapshot.level.goal.x - racer.x,
    dy: snapshot.level.goal.y - racer.y,
  };

  return {
    tick,
    position,
    facing: racer.facing,
    onGround: racer.onGround,
    isAlive: racer.isAlive,
    nearbyTiles,
    nearestCoin,
    nearestHazard,
    nearestUtility,
    goalDirection,
    coinsCollected: racer.coinsCollected,
    livesRemaining: racer.livesRemaining,
    timeElapsedMs: racer.timeElapsedMs,
  };
}

function toNearestCoin(from: Positioned, coins: WorldSnapshot["visibleCoins"]): NearestCoin | null {
  const nearest = nearestByDistance(from, coins);
  if (!nearest) return null;
  return { dx: nearest.x - from.x, dy: nearest.y - from.y, value: nearest.value };
}

function toNearestHazard(
  from: Positioned,
  hazards: WorldSnapshot["hazards"]
): NearestHazard | null {
  const nearest = nearestByDistance(from, hazards);
  if (!nearest) return null;
  return {
    dx: nearest.x - from.x,
    dy: nearest.y - from.y,
    kind: nearest.kind,
    active: nearest.active,
  };
}

function toNearestUtility(
  from: Positioned,
  utilities: WorldSnapshot["utilities"]
): NearestUtility | null {
  const nearest = nearestByDistance(from, utilities);
  if (!nearest) return null;
  return { dx: nearest.x - from.x, dy: nearest.y - from.y, kind: nearest.kind };
}
