import { MOVEMENT_TUNING } from "./movement/movement";

export function createPhysicsConfig(debug = false) {
  return {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: MOVEMENT_TUNING.GRAVITY_Y },
      fixedStep: true,
      fps: 60,
      debug,
    },
  };
}
