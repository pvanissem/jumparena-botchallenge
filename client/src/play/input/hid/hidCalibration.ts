/**
 * Kalibrierung auf rohen HID-Reports – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Gleiche Schrittfolge wie beim Gamepad-API-Pfad (`calibration.ts`), aber auf
 * Byte-Ebene. Die Ruhelage entsteht als MEDIAN je Byte über ein Fenster; damit
 * sind Rauschen und einzelne Ausreißer wirkungslos, und es braucht keine
 * fehleranfällige "Ist das Pad gerade ruhig?"-Heuristik.
 */
import type { PlayInput } from "../inputs";
import { CALIBRATION_STEPS } from "../inputs";
import { detectHidBinding, type HidBinding, resolveHidBinding } from "./hidBindings";
import type { HidMapping } from "./hidMapping";

/** So viele Reports fließen in die Ruhelage ein. */
export const HID_REST_SAMPLES = 20;

export interface HidCalibrationState {
  phase: "measuring-rest" | "capture" | "verify" | "done";
  deviceKey: string;
  label: string;
  reportId: number;
  /** Ruhewerte je Byte (Median über das Messfenster). */
  rest: number[] | null;
  restSamples: number[][];
  restSampleCount: number;
  stepIndex: number;
  waitingForRelease: boolean;
  bindings: Partial<Record<PlayInput, HidBinding>>;
  error: "already-bound" | null;
}

export type HidCalibrationEvent =
  | { type: "report"; reportId: number; bytes: number[] }
  | { type: "restart" }
  | { type: "accept" };

export function createHidCalibrationState(deviceKey: string, label: string): HidCalibrationState {
  return {
    phase: "measuring-rest",
    deviceKey,
    label,
    reportId: 0,
    rest: null,
    restSamples: [],
    restSampleCount: 0,
    stepIndex: 0,
    waitingForRelease: false,
    bindings: {},
    error: null,
  };
}

/** Median je Byte-Position – robust gegen einzelne abweichende Reports. */
function medianBytes(samples: readonly number[][]): number[] {
  const length = Math.max(...samples.map((sample) => sample.length));
  const result: number[] = [];

  for (let index = 0; index < length; index++) {
    const values = samples
      .map((sample) => sample[index])
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);

    const middle = Math.floor(values.length / 2);
    result.push(values.length === 0 ? 0 : values[middle]);
  }

  return result;
}

function isAlreadyBound(
  bindings: Partial<Record<PlayInput, HidBinding>>,
  candidate: HidBinding
): boolean {
  return Object.values(bindings).some(
    (binding) => binding && JSON.stringify(binding) === JSON.stringify(candidate)
  );
}

/** Ist der Report (wieder) deckungsgleich mit der Ruhelage? */
function isAtRest(bytes: readonly number[], rest: readonly number[]): boolean {
  return rest.every((value, index) => Math.abs((bytes[index] ?? value) - value) < 0x20);
}

export function hidCalibrationReducer(
  state: HidCalibrationState,
  event: HidCalibrationEvent
): HidCalibrationState {
  switch (event.type) {
    case "restart":
      return {
        ...state,
        phase: state.rest ? "capture" : "measuring-rest",
        stepIndex: 0,
        bindings: {},
        waitingForRelease: false,
        error: null,
      };

    case "accept":
      return state.phase === "verify" ? { ...state, phase: "done" } : state;

    case "report":
      return applyReport(state, event.reportId, event.bytes);
  }
}

function applyReport(
  state: HidCalibrationState,
  reportId: number,
  bytes: number[]
): HidCalibrationState {
  // 1. Ruhelage vermessen.
  if (!state.rest) {
    const restSamples = [...state.restSamples, bytes];
    if (restSamples.length < HID_REST_SAMPLES) {
      return { ...state, restSamples, restSampleCount: restSamples.length, reportId };
    }
    return {
      ...state,
      reportId,
      restSamples,
      restSampleCount: restSamples.length,
      rest: medianBytes(restSamples),
      phase: "capture",
    };
  }

  if (state.phase !== "capture") return state;

  // 2. Nach einer Erfassung erst die Rückkehr in die Ruhelage abwarten.
  if (state.waitingForRelease) {
    if (!isAtRest(bytes, state.rest)) return state;
    return advanceAfterRelease(state);
  }

  // 3. Abweichung von der Ruhelage = gesuchte Eingabe.
  const detected = detectHidBinding(reportId, state.rest, bytes);
  if (!detected) return state;

  if (isAlreadyBound(state.bindings, detected)) {
    return { ...state, error: "already-bound", waitingForRelease: true };
  }

  const step = CALIBRATION_STEPS[state.stepIndex];
  return {
    ...state,
    bindings: { ...state.bindings, [step]: detected },
    waitingForRelease: true,
    error: null,
  };
}

function advanceAfterRelease(state: HidCalibrationState): HidCalibrationState {
  const step = CALIBRATION_STEPS[state.stepIndex];
  if (!state.bindings[step]) {
    // Fehlerfall (bereits belegt): im selben Schritt bleiben.
    return { ...state, waitingForRelease: false };
  }

  const nextStepIndex = state.stepIndex + 1;
  if (nextStepIndex >= CALIBRATION_STEPS.length) {
    return { ...state, phase: "verify", waitingForRelease: false };
  }

  return { ...state, stepIndex: nextStepIndex, waitingForRelease: false };
}

export function toHidMapping(state: HidCalibrationState): HidMapping | null {
  const bindings = state.bindings;
  if (CALIBRATION_STEPS.some((input) => !bindings[input])) return null;

  return {
    deviceKey: state.deviceKey,
    label: state.label,
    bindings: bindings as Record<PlayInput, HidBinding>,
  };
}

/** Für das Testbild: welche Eingaben sind gerade aktiv? */
export function activeHidInputs(state: HidCalibrationState, bytes: readonly number[]): PlayInput[] {
  return CALIBRATION_STEPS.filter((input) => {
    const binding = state.bindings[input];
    return !!binding && resolveHidBinding(bytes, binding);
  });
}
