/**
 * Steuerungs-Abstraktion – siehe `.features/level-one-arena/design.md`,
 * Abschnitt "control/RacerController.ts" (DIP: RaceScene kennt nur dieses
 * Interface, nicht ob Tastatur oder Bot dahintersteckt).
 */
import type { Action, BotState } from "@arena/bot-contract";

export interface ControllerInput {
  /** Für BotController; KeyboardController ignoriert es (siehe design.md). */
  botState: BotState;
}

export interface RacerController {
  getNextActions(input: ControllerInput): Action[] | Promise<Action[]>;
  dispose(): void;
}
