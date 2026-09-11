/**
 * Steuerquelle auf Basis roher HID-Reports – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Erfüllt dieselbe `HumanInputSource` wie `GamepadController` und
 * `KeyboardController` und leitet die Actions nach identischer Regel ab. Für
 * `RaceScene` ist damit nicht erkennbar, ob die Eingabe aus der Gamepad-API,
 * von der Tastatur oder direkt vom HID-Gerät kommt (DIP).
 */
import type { Action } from "@arena/bot-contract";
import type { DirectionalInput, HumanInputSource } from "../../../game/control/RacerController";
import type { HidSource } from "./HidSource";
import type { HidMapping } from "./hidMapping";
import { readHidSnapshot } from "./hidMapping";

const IDLE: DirectionalInput = { dir: 0, jump: false, sprint: false };

export class HidController implements HumanInputSource {
  constructor(
    private readonly source: HidSource,
    private readonly mapping: HidMapping
  ) {}

  getInput(): DirectionalInput {
    const report = this.source.latest();
    if (!report) return IDLE;

    const snapshot = readHidSnapshot(report.bytes, this.mapping);
    return {
      dir: snapshot.left ? -1 : snapshot.right ? 1 : 0,
      jump: snapshot.jump,
      sprint: snapshot.sprint,
    };
  }

  /** Logischer Gesamtzustand – für Menü-Flanken (siehe `useStationInputLoop`). */
  snapshot() {
    const report = this.source.latest();
    return report ? readHidSnapshot(report.bytes, this.mapping) : null;
  }

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

  isConnected(): boolean {
    return this.source.isConnected();
  }

  dispose(): void {
    // Die HID-Verbindung gehört der Seite, nicht diesem Controller – sie wird
    // bewusst NICHT hier geschlossen (mehrere Level teilen sich eine Quelle).
  }
}
