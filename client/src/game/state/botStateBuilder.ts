/**
 * Baut den `BotState`-Contract (`@arena/bot-contract`) aus einer `WorldSnapshot`
 * + `RacerRuntimeState` (+ transiente Laufzeit-`extras`) – siehe
 * `.features/bot-state-vision/design.md`. Pure Funktion, keine Phaser-Typen.
 */
import type { BotState, VisibleCoin, VisibleHazard, VisibleUtility } from "@arena/bot-contract";
import { HAZARD_REGISTRY } from "../hazards/registry";
import { buildNearbyTiles, TILE_SIZE } from "../level/tiles";
import type { RacerRuntimeState } from "../rules/racerState";
import { computeGapAhead } from "./gapAhead";
import { withinViewRadius } from "./viewport";
import type { WorldSnapshot } from "./worldSnapshot";

interface Positioned {
  x: number;
  y: number;
}

/** Transiente, nur zur Laufzeit (Phaser) bekannte Werte – bewusst als explizite,
 *  primitive Eingaben, damit `buildBotState` pur/testbar bleibt (ISP). */
export interface BotStateExtras {
  velocity: { vx: number; vy: number };
  isSprinting: boolean;
  justRespawned: boolean;
  tookDamage: boolean;
}

/**
 * Bildet Kandidaten auf sichtbare, distanz-sortierte Relativ-Objekte ab:
 * filtert per Sichtradius, sortiert aufsteigend nach quadrierter Distanz (kein
 * `Math.sqrt` nötig) und mappt jeden Treffer via `mapFn` auf das Contract-Objekt.
 */
function toVisibleList<TIn extends Positioned, TOut extends { dx: number; dy: number }>(
  from: Positioned,
  items: readonly TIn[],
  mapFn: (item: TIn, dx: number, dy: number) => TOut
): TOut[] {
  const result: Array<{ out: TOut; distSq: number }> = [];
  for (const item of items) {
    const dx = item.x - from.x;
    const dy = item.y - from.y;
    if (!withinViewRadius(dx, dy)) continue;
    result.push({ out: mapFn(item, dx, dy), distSq: dx * dx + dy * dy });
  }
  result.sort((a, b) => a.distSq - b.distSq);
  return result.map((entry) => entry.out);
}

export function buildBotState(
  snapshot: WorldSnapshot,
  racer: RacerRuntimeState,
  tick: number,
  extras: BotStateExtras
): BotState {
  const position = { x: racer.x, y: racer.y };

  const coins = toVisibleList(
    position,
    snapshot.visibleCoins,
    (coin, dx, dy): VisibleCoin => ({ dx, dy, value: coin.value })
  );
  const hazards = toVisibleList(
    position,
    snapshot.hazards,
    (hazard, dx, dy): VisibleHazard => ({
      dx,
      dy,
      kind: hazard.kind,
      active: hazard.active,
      warning: hazard.warning,
      stompable: HAZARD_REGISTRY[hazard.kind].stompable,
    })
  );
  const utilities = toVisibleList(
    position,
    snapshot.utilities,
    (utility, dx, dy): VisibleUtility => ({ dx, dy, kind: utility.kind })
  );

  const centerCol = Math.floor(racer.x / TILE_SIZE);
  const centerRow = Math.floor(racer.y / TILE_SIZE);
  const nearbyTiles = buildNearbyTiles(snapshot.level, snapshot.dynamic, centerCol, centerRow);

  return {
    tick,
    position,
    facing: racer.facing,
    onGround: racer.onGround,
    isAlive: racer.isAlive,
    velocity: extras.velocity,
    isSprinting: extras.isSprinting,
    nearbyTiles,
    nearestCoin: coins[0] ?? null,
    nearestHazard: hazards[0] ?? null,
    nearestUtility: utilities[0] ?? null,
    coins,
    hazards,
    utilities,
    goalDirection: {
      dx: snapshot.level.goal.x - racer.x,
      dy: snapshot.level.goal.y - racer.y,
    },
    gapAhead: computeGapAhead(snapshot.level, racer.x, racer.y, racer.facing),
    worldBounds: { width: snapshot.level.worldWidth, height: snapshot.level.worldHeight },
    justRespawned: extras.justRespawned,
    tookDamage: extras.tookDamage,
    coinsCollected: racer.coinsCollected,
    livesRemaining: racer.livesRemaining,
    timeElapsedMs: racer.timeElapsedMs,
  };
}
