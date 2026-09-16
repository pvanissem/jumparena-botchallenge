import type { BotState, NavigationObservation, VisiblePlatform } from "@arena/bot-contract";

export function platform(
  id: string,
  x: number,
  y: number,
  width: number,
  height = 32,
  collision: "solid" | "one-way-up" = "solid"
): VisiblePlatform {
  return { id, dx: x, dy: y, width, height, collision, kind: "ground" };
}

// position deliberately differs from the body origin. All object bounds are
// relative to position, NOT to navigation.body.
export function fixture(): BotState & { navigation: NavigationObservation } {
  return {
    tick: 0,
    position: { x: 0, y: 0 },
    facing: "right",
    onGround: true,
    isAlive: true,
    velocity: { vx: 0, vy: 0 },
    isSprinting: false,
    sprintRampProgress: 0,
    nearbyTiles: [],
    platforms: [platform("floor", 0, 300, 1000)],
    tuning: {
      gravity: 900,
      tileSize: 16,
      tickMs: 33,
      baseMoveSpeed: 200,
      sprintMoveSpeed: 320,
      sprintRampMs: 450,
      baseJumpVelocity: -560,
      sprintJumpVelocity: -650,
      minJumpHoldMs: 180,
      botWidth: 24,
      botHeight: 32,
    },
    nearestCoin: null,
    nearestHazard: null,
    nearestUtility: null,
    coins: [],
    hazards: [],
    utilities: [],
    goalDirection: { dx: 950, dy: 280 },
    gapAhead: { present: false, distance: null },
    worldBounds: { width: 1200, height: 600 },
    justRespawned: false,
    tookDamage: false,
    coinsCollected: 0,
    livesRemaining: 3,
    timeElapsedMs: 0,
    navigation: {
      version: 1,
      epoch: 1,
      frame: 0,
      observedAtMs: 0,
      physicsStepMs: 1000 / 60,
      body: { x: 80, y: 268, width: 24, height: 32 },
      movement: { jumpStartedAtMs: null, impulseKind: "none", impulseAtMs: null, sourceId: null },
      viewport: { x: 0, y: 0, width: 1100, height: 600 },
      boingoJumpVelocity: -820,
      stompJumpVelocity: -280,
    },
  };
}
