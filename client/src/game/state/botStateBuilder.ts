/**
 * Baut den `BotState`-Contract (`@arena/bot-contract`) aus einer `WorldSnapshot`
 * + `RacerRuntimeState` (+ transiente Laufzeit-`extras`) – siehe
 * `.features/bot-state-vision/design.md`. Pure Funktion, keine Phaser-Typen.
 */
import type { BotState } from "@arena/bot-contract";
import { HAZARD_REGISTRY } from "../hazards/registry";
import { buildNearbyTiles, TILE_SIZE } from "../level/tiles";
import { MOVEMENT_TUNING } from "../movement/movement";
import type { RacerRuntimeState } from "../rules/racerState";
import { computeGapAhead } from "./gapAhead";
import { VIEW_HALF_HEIGHT_PX, VIEW_HALF_WIDTH_PX, withinView } from "./viewport";
import { buildVisiblePlatforms, rectIntersectsView } from "./visiblePlatforms";
import type { NavigationObservation, WorldRect, WorldSnapshot } from "./worldSnapshot";

interface Positioned {
  x: number;
  y: number;
  bounds?: WorldRect;
}

/** Transiente, nur zur Laufzeit (Phaser) bekannte Werte – bewusst als explizite,
 *  primitive Eingaben, damit `buildBotState` pur/testbar bleibt (ISP). */
export interface BotStateExtras {
  velocity: { vx: number; vy: number };
  isSprinting: boolean;
  /** Wie lange ununterbrochen in dieselbe Sprint-Richtung gehalten wurde
   *  (siehe `RaceScene.sprintHoldMs`) – Grundlage für `sprintRampProgress`. */
  sprintHoldMs: number;
  justRespawned: boolean;
  tookDamage: boolean;
  navigation?: Omit<
    NavigationObservation,
    "version" | "viewport" | "goalBounds" | "boingoJumpVelocity" | "stompJumpVelocity"
  >;
}

/**
 * Bildet Kandidaten auf sichtbare, distanz-sortierte Relativ-Objekte ab:
 * filtert per Sichtrechteck, sortiert aufsteigend nach quadrierter Distanz (kein
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
    if (
      item.bounds
        ? !rectIntersectsView(item.bounds, from.x, from.y, VIEW_HALF_WIDTH_PX, VIEW_HALF_HEIGHT_PX)
        : !withinView(dx, dy)
    )
      continue;
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
) {
  const position = { x: racer.x, y: racer.y };
  const relativeBounds = (bounds?: WorldRect) =>
    bounds
      ? {
          bounds: {
            dx: bounds.x - position.x,
            dy: bounds.y - position.y,
            width: bounds.width,
            height: bounds.height,
          },
        }
      : {};

  const coins = toVisibleList(position, snapshot.visibleCoins, (coin, dx, dy) => ({
    id: coin.id,
    dx,
    dy,
    value: coin.value,
    ...relativeBounds(coin.bounds),
  }));
  const hazards = toVisibleList(position, snapshot.hazards, (hazard, dx, dy) => ({
    id: hazard.id,
    ...relativeBounds(hazard.bounds),
    dx,
    dy,
    kind: hazard.kind,
    active: hazard.active,
    warning: hazard.warning,
    stompable: HAZARD_REGISTRY[hazard.kind].stompable,
    vx: hazard.vx ?? 0,
    vy: hazard.vy ?? 0,
  }));
  const utilities = toVisibleList(position, snapshot.utilities, (utility, dx, dy) => ({
    id: utility.id,
    dx,
    dy,
    kind: utility.kind,
    ...relativeBounds(utility.bounds),
  }));

  const centerCol = Math.floor(racer.x / TILE_SIZE);
  const centerRow = Math.floor(racer.y / TILE_SIZE);
  const nearbyTiles = buildNearbyTiles(snapshot.level, snapshot.dynamic, centerCol, centerRow);
  const platforms = buildVisiblePlatforms(
    snapshot.level,
    snapshot.dynamic.resolvedBlockIds,
    racer.x,
    racer.y,
    VIEW_HALF_WIDTH_PX,
    VIEW_HALF_HEIGHT_PX,
    snapshot.levelId,
    snapshot.dynamic.blocks
  );
  const sprintRampProgress = Math.max(
    0,
    Math.min(1, extras.sprintHoldMs / MOVEMENT_TUNING.SPRINT_RAMP_MS)
  );

  const navigation: NavigationObservation | undefined = extras.navigation
    ? {
        version: 1,
        ...extras.navigation,
        body: { ...extras.navigation.body },
        movement: { ...extras.navigation.movement },
        viewport: {
          x: racer.x - VIEW_HALF_WIDTH_PX,
          y: racer.y - VIEW_HALF_HEIGHT_PX,
          width: VIEW_HALF_WIDTH_PX * 2,
          height: VIEW_HALF_HEIGHT_PX * 2,
        },
        ...(snapshot.goalBounds &&
        rectIntersectsView(
          snapshot.goalBounds,
          racer.x,
          racer.y,
          VIEW_HALF_WIDTH_PX,
          VIEW_HALF_HEIGHT_PX
        )
          ? { goalBounds: { ...snapshot.goalBounds } }
          : {}),
        boingoJumpVelocity: MOVEMENT_TUNING.BOINGO_JUMP_VELOCITY,
        stompJumpVelocity: MOVEMENT_TUNING.STOMP_JUMP_VELOCITY,
      }
    : undefined;

  return {
    ...(navigation ? { navigation } : {}),
    tick,
    position,
    facing: racer.facing,
    onGround: racer.onGround,
    isAlive: racer.isAlive,
    velocity: extras.velocity,
    isSprinting: extras.isSprinting,
    sprintRampProgress,
    nearbyTiles,
    platforms,
    tuning: {
      gravity: MOVEMENT_TUNING.GRAVITY_Y,
      tileSize: TILE_SIZE,
      tickMs: MOVEMENT_TUNING.BOT_TICK_INTERVAL_MS,
      baseMoveSpeed: MOVEMENT_TUNING.BASE_MOVE_SPEED,
      sprintMoveSpeed: MOVEMENT_TUNING.SPRINT_MOVE_SPEED,
      sprintRampMs: MOVEMENT_TUNING.SPRINT_RAMP_MS,
      baseJumpVelocity: MOVEMENT_TUNING.BASE_JUMP_VELOCITY,
      sprintJumpVelocity: MOVEMENT_TUNING.SPRINT_JUMP_VELOCITY,
      minJumpHoldMs: MOVEMENT_TUNING.MIN_JUMP_HOLD_MS,
      botWidth: navigation?.body.width ?? MOVEMENT_TUNING.PLAYER_BODY_SIZE.width,
      botHeight: navigation?.body.height ?? MOVEMENT_TUNING.PLAYER_BODY_SIZE.height,
    },
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
  } satisfies BotState & { navigation?: NavigationObservation };
}
