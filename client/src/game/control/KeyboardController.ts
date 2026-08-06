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
   * Einzelne `Action` pro Aufruf – Bot-Parität (z.B. für Tests/Vergleiche).
   * Für die tatsächliche Steuerung in `RaceScene` wird `getInput()`
   * verwendet, das gleichzeitige Bewegung + Sprung + Sprint erlaubt.
   */
  getNextAction(): Action {
    const dir = this.keys.left.isDown ? -1 : this.keys.right.isDown ? 1 : 0;
    if (dir !== 0 && this.keys.shift.isDown) {
      return dir < 0 ? "sprint-left" : "sprint-right";
    }
    if (dir < 0) return "left";
    if (dir > 0) return "right";
    if (this.keys.space.isDown) return "jump";
    return "idle";
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
