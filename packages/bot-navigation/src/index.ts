import { createMovementController as createMotor } from "./controller";
import { movementOptions } from "./options";
import { createNavigator } from "./navigator";
import type { BotState, ControlCommand, NavigationIntent } from "@arena/bot-contract";
export function createMovementController() {
  const motor = createMotor(),
    navigator = createNavigator(motor);
  let navigating = false;
  return {
    options: movementOptions,
    run(s: BotState, command: ControlCommand) {
      if (navigating) {
        navigator.reset();
        motor.reset();
        navigating = false;
      }
      return motor.run(s, command);
    },
    navigate(s: BotState, intent: NavigationIntent) {
      navigating = true;
      return navigator.navigate(s, intent);
    },
    status(s: BotState) {
      return navigating ? navigator.status(s) : motor.status(s);
    },
    command: () => (navigating ? navigator.command() : null),
    reset() {
      navigating = false;
      navigator.reset();
      motor.reset();
    },
  };
}
