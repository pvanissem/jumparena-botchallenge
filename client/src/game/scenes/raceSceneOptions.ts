/**
 * Pure Auswertung der `RaceSceneInitData`-Optionen – siehe
 * `.features/play-mode/design.md`, Abschnitt "Änderungen an `RaceScene`".
 *
 * Bewusst aus der Szene herausgezogen: Damit sind die Entscheidungen
 * "welche Steuerquelle?" und "welche Audio-Anteile?" ohne laufendes Phaser
 * testbar, während die Szene selbst nur noch ausführt.
 */
import type { HumanInputSource } from "../control/RacerController";

export type ControllerMode = "keyboard" | "bot" | "gamepad";

export interface ControllerChoiceInput {
  controllerMode: ControllerMode;
  botSourceCode?: string;
  humanInput?: HumanInputSource;
}

export type ControllerChoice =
  | { kind: "bot"; botSourceCode: string }
  | { kind: "gamepad"; humanInput: HumanInputSource }
  | { kind: "keyboard" };

export function resolveControllerChoice(init: ControllerChoiceInput): ControllerChoice {
  if (init.controllerMode === "bot" && init.botSourceCode) {
    return { kind: "bot", botSourceCode: init.botSourceCode };
  }

  if (init.controllerMode === "gamepad") {
    // Fail-Fast statt stillem Rückfall auf die Tastatur: Ein `/play`-Racer ohne
    // Gamepad-Quelle wäre am Stand nicht steuerbar und der Fehler schwer zu
    // finden (Muster: `getLevelById`).
    if (!init.humanInput) {
      throw new Error(
        'RaceScene: controllerMode "gamepad" erfordert eine injizierte humanInput-Quelle.'
      );
    }
    return { kind: "gamepad", humanInput: init.humanInput };
  }

  return { kind: "keyboard" };
}

/** Musik und Soundeffekte getrennt schaltbar – im `/play`-Modus laufen zwei
 *  Szenen gleichzeitig, die Musik darf aber nur EINMAL erklingen (US-5). */
export type AudioOption = boolean | { music: boolean; sfx: boolean };

export interface AudioFlags {
  music: boolean;
  sfx: boolean;
}

export function normalizeAudioOption(audio: AudioOption | undefined): AudioFlags {
  if (audio === undefined) return { music: true, sfx: true };
  if (typeof audio === "boolean") return { music: audio, sfx: audio };
  return { music: audio.music, sfx: audio.sfx };
}
