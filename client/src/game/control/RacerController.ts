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

/**
 * Rohes, mehrachsiges Eingabesignal für EINEN Frame: horizontale Bewegung,
 * Sprung UND Sprint können gleichzeitig aktiv sein. Bewusst kein Teil des
 * `Action`-Contracts (`@arena/bot-contract` bleibt unverändert).
 */
export interface DirectionalInput {
  dir: -1 | 0 | 1;
  jump: boolean;
  /** Nur zusammen mit `dir !== 0` als "Sprint" relevant. */
  sprint: boolean;
}

/**
 * Steuerquelle eines MENSCHLICHEN Spielers (Tastatur oder Gamepad). Zusätzlich
 * zum Bot-tauglichen `getNextActions` liefert sie das mehrachsige Rohsignal,
 * das `RaceScene` jeden Frame synchron auswertet (siehe dort
 * `applyHumanInput`). Damit teilen sich Tastatur und Gamepad exakt denselben
 * Bewegungspfad – keine duplizierte Sprung-/Sprint-Logik pro Eingabegerät.
 */
export interface HumanInputSource extends RacerController {
  getInput(): DirectionalInput;
}
