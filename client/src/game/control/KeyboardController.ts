/**
 * Tastatursteuerung (Testmodus "Selbst spielen") – siehe design.md,
 * Abschnitt "control/RacerController.ts".
 */
import type { Action } from "@arena/bot-contract";
import type { RacerController } from "./RacerController";

interface KeyState {
  isDown: boolean;
}

/** Strukturell kompatibel zu Phaser.Types.Input.Keyboard.CursorKeys (nur die
 *  hier benötigten Tasten), damit dies ohne echtes Phaser-Objekt testbar ist. */
export interface CursorKeysLike {
  left: KeyState;
  right: KeyState;
  space: KeyState;
  shift: KeyState;
}

/** Rohes, mehrachsiges Tastatur-Eingabesignal für EINEN Frame (Multi-Input:
 *  horizontale Bewegung, Sprung UND Sprint können gleichzeitig aktiv sein).
 *  Bewusst kein Teil des `Action`-Contracts (`@arena/bot-contract` bleibt
 *  unverändert) – nur `RaceScene` nutzt dies für den Tastatur-Sonderpfad. */
export interface KeyboardInput {
  dir: -1 | 0 | 1;
  jump: boolean;
  /** Ob Shift gehalten wird (nur zusammen mit `dir!==0` als "Sprint" relevant). */
  sprint: boolean;
}

export class KeyboardController implements RacerController {
  constructor(private readonly keys: CursorKeysLike) {}

  /**
   * Mehrere gleichzeitige Actions für diesen Frame – Bot-Parität: dieselbe
   * Multi-Action-Liste, die auch ein Bot zurückgeben würde (Bewegung/Sprint +
   * Sprung kombinierbar). Aus dem mehrachsigen `getInput()` abgeleitet (DRY).
   */
  getNextActions(): Action[] {
    const { dir, jump, sprint } = this.getInput();
    const actions: Action[] = [];
    if (dir !== 0) {
      if (sprint) {
        actions.push(dir < 0 ? "sprint-left" : "sprint-right");
      } else {
        actions.push(dir < 0 ? "left" : "right");
      }
    }
    if (jump) actions.push("jump");
    return actions;
  }

  /** Mehrachsiges Rohsignal für den aktuellen Frame (siehe `KeyboardInput`). */
  getInput(): KeyboardInput {
    const dir = this.keys.left.isDown ? -1 : this.keys.right.isDown ? 1 : 0;
    return { dir, jump: this.keys.space.isDown, sprint: this.keys.shift.isDown };
  }

  dispose(): void {
    // Kein Ressourcen-Cleanup nötig – Tastatur-Events werden von Phaser selbst verwaltet.
  }
}
