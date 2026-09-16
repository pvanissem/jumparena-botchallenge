import { createMovementController as createMotor } from "./controller";
import { movementOptions } from "./options";
export function createMovementController() {
  return { ...createMotor(), options: movementOptions };
}
