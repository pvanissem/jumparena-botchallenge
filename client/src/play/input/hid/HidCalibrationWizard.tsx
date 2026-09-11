/**
 * Kalibrierungs-Assistent für den HID-Rohzugriff – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Gleicher Ablauf und gleiche Optik wie der Gamepad-API-Assistent, aber auf
 * Byte-Ebene. Nötig, weil Chromiums Gamepad-Mapping für die am Stand
 * verwendeten Adapter unvollständig ist (links/rechts fehlen dort komplett).
 */
import { useCallback, useReducer, useRef, useState } from "react";
import { useFrameLoop } from "../../useFrameLoop";
import { CALIBRATION_STEPS, INPUT_LABELS, PLAY_INPUTS, type PlayInput } from "../inputs";
import { formatReportBytes } from "./formatBytes";
import type { HidSource } from "./HidSource";
import {
  activeHidInputs,
  createHidCalibrationState,
  HID_REST_SAMPLES,
  hidCalibrationReducer,
  toHidMapping,
} from "./hidCalibration";
import type { HidMapping } from "./hidMapping";

interface HidCalibrationWizardProps {
  source: HidSource;
  deviceKey: string;
  label: string;
  /** Beschriftung der Station, für die kalibriert wird. */
  stationLabel: string;
  onComplete: (mapping: HidMapping) => void;
  onCancel: () => void;
}

export function HidCalibrationWizard({
  source,
  deviceKey,
  label,
  stationLabel,
  onComplete,
  onCancel,
}: HidCalibrationWizardProps) {
  const [state, dispatch] = useReducer(hidCalibrationReducer, { deviceKey, label }, (init) =>
    createHidCalibrationState(init.deviceKey, init.label)
  );
  const [active, setActive] = useState<readonly PlayInput[]>([]);
  const [bytes, setBytes] = useState<number[]>([]);
  const activeKeyRef = useRef("");

  useFrameLoop(() => {
    const report = source.latest();
    if (!report) return;

    dispatch({ type: "report", reportId: report.reportId, bytes: report.bytes });

    // Live-Anzeige nur bei Änderung setzen (der Reducer liefert in ruhigen
    // Phasen bewusst denselben Zustand zurück).
    const next = activeHidInputs(state, report.bytes);
    const key = next.join(",");
    if (key !== activeKeyRef.current) {
      activeKeyRef.current = key;
      setActive(next);
    }
    setBytes(report.bytes);
  });

  const accept = useCallback(() => {
    const mapping = toHidMapping(state);
    if (mapping) onComplete(mapping);
  }, [onComplete, state]);

  return (
    <section className="play-calibration">
      <h1 className="play-calibration__title">Controller einrichten (Rohzugriff)</h1>
      <p className="play-calibration__station">{stationLabel}</p>

      {state.phase === "measuring-rest" && (
        <div className="play-calibration__step">
          <p className="play-calibration__hint">
            Bitte nichts drücken – der Ruhezustand wird gemessen …
          </p>
          <div className="play-hud__time">
            <div
              className="play-hud__time-bar"
              style={{ width: `${Math.round((state.restSampleCount / HID_REST_SAMPLES) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {state.phase === "capture" && (
        <div className="play-calibration__step">
          <p className="play-calibration__hint">Drücke die Taste für</p>
          <p className="play-calibration__input" data-testid="hid-step">
            {INPUT_LABELS[CALIBRATION_STEPS[state.stepIndex]]}
          </p>
          <p className="play-calibration__progress">
            Schritt {state.stepIndex + 1} von {CALIBRATION_STEPS.length}
          </p>
          {state.error === "already-bound" && (
            <p className="play-calibration__error">
              Diese Taste ist bereits belegt – bitte eine andere drücken.
            </p>
          )}
        </div>
      )}

      {state.phase === "verify" && (
        <div className="play-calibration__verify">
          <p className="play-calibration__hint">
            Alles einmal durchdrücken – leuchtet jede Taste richtig auf?
          </p>
          <ul className="play-calibration__live">
            {PLAY_INPUTS.map((input) => (
              <li
                key={input}
                data-testid={`hid-live-${input}`}
                data-active={active.includes(input) ? "true" : "false"}
                className={`play-calibration__live-item${
                  active.includes(input) ? " is-active" : ""
                }`}
              >
                {INPUT_LABELS[input]}
              </li>
            ))}
          </ul>
          <div className="play-calibration__actions">
            <button type="button" className="play-button" onClick={accept}>
              Passt so
            </button>
            <button
              type="button"
              className="play-button play-button--ghost"
              onClick={() => dispatch({ type: "restart" })}
            >
              Nochmal
            </button>
          </div>
        </div>
      )}

      <p className="play-calibration__diagnostics" data-testid="hid-calibration-bytes">
        {label} · Bytes: {bytes.length > 0 ? formatReportBytes(bytes) : "– noch nichts empfangen –"}
      </p>

      <div className="play-calibration__footer">
        <button type="button" className="play-button play-button--ghost" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </section>
  );
}
