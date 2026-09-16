import type { BotState } from "@arena/bot-contract";
import type { TraceTickSample } from "./types";

const round2 = (value: number): number => Math.round(value * 100) / 100;
const point = ({ x, y }: { x: number; y: number }) => ({ x: round2(x), y: round2(y) });
const relative = ({ dx, dy }: { dx: number; dy: number }) => ({ dx: round2(dx), dy: round2(dy) });

export function compactBotTick(state: BotState): TraceTickSample {
  return {
    tick: state.tick,
    stateTick: state.tick,
    ...(state.navigation
      ? {
          epoch: state.navigation.epoch,
          stateFrame: state.navigation.frame,
          navigation: structuredClone(state.navigation),
        }
      : {}),
    timeMs: Math.round(state.timeElapsedMs),
    position: point(state.position),
    velocity: { vx: round2(state.velocity.vx), vy: round2(state.velocity.vy) },
    facing: state.facing,
    onGround: state.onGround,
    isSprinting: state.isSprinting,
    sprintRampProgress: round2(state.sprintRampProgress),
    gapAhead: {
      present: state.gapAhead.present,
      distance: state.gapAhead.distance === null ? null : round2(state.gapAhead.distance),
    },
    goalDirection: relative(state.goalDirection),
    justRespawned: state.justRespawned,
    tookDamage: state.tookDamage,
    nearbyTiles: state.nearbyTiles.map((row) => [...row]),
    hazards: state.hazards.map((hazard) => ({
      ...structuredClone(hazard),
      ...relative(hazard),
      vx: round2(hazard.vx),
      vy: round2(hazard.vy),
    })),
    coins: state.coins.map((coin) => ({ ...structuredClone(coin), ...relative(coin) })),
    utilities: state.utilities.map((utility) => ({
      ...structuredClone(utility),
      ...relative(utility),
    })),
    platforms: state.platforms.map((platform) => ({
      ...structuredClone(platform),
      ...relative(platform),
      width: round2(platform.width),
      height: round2(platform.height),
    })),
    ...(state.checkpoints ? { checkpoints: structuredClone(state.checkpoints) } : {}),
    ...(state.respawnPoint ? { respawnPoint: structuredClone(state.respawnPoint) } : {}),
    decision: null,
  };
}
