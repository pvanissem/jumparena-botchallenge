/**
 * Bot-gesteuerter Testmodus – wrappt den `BotRunner` aus `bot-decide-api`.
 * Siehe design.md, Abschnitt "control/RacerController.ts".
 */
import type { Action } from "@arena/bot-contract";
import type { BotRunner } from "../../sandbox/BotRunner";
import type { ControllerInput, RacerController } from "./RacerController";

export class BotController implements RacerController {
  constructor(private readonly runner: BotRunner) {}

  getNextActions(input: ControllerInput): Promise<Action[]> {
    return this.runner.tick(input.botState);
  }

  dispose(): void {
    this.runner.dispose();
  }
}
