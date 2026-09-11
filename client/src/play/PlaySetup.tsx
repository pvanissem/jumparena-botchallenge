/**
 * Einrichtungs-Bildschirm für `/play` – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Wird gezeigt, solange keine Station eine kalibrierte Eingabequelle hat.
 * Die Eingabe läuft ausschließlich über den Rohzugriff (WebHID): Chromiums
 * Gamepad-Mapping ist für die am Stand verwendeten Adapter unvollständig,
 * links/rechts kommen dort gar nicht an.
 */
import { STATION_IDS, STATION_LABELS } from "./input/inputs";
import type { HidStationDevice } from "./useHidDevices";

interface PlaySetupProps {
  supported: boolean;
  devices: readonly HidStationDevice[];
  /** Welche Geräte haben bereits eine gespeicherte Belegung? */
  isCalibrated: (deviceKey: string) => boolean;
  error: string | null;
  onConnect: () => void;
  onCalibrate: (device: HidStationDevice) => void;
}

export function PlaySetup({
  supported,
  devices,
  isCalibrated,
  error,
  onConnect,
  onCalibrate,
}: PlaySetupProps) {
  return (
    <section className="play-calibration play-setup">
      <h1 className="play-calibration__title">Controller einrichten</h1>

      <p className="play-calibration__hint">
        Der Controller wird <strong>direkt ausgelesen</strong>. Das ist nötig, weil der Browser
        viele USB-Adapter nur unvollständig erkennt – bei manchen fehlt das{" "}
        <strong>Steuerkreuz links/rechts</strong> vollständig.
      </p>

      {supported ? (
        <button type="button" className="play-button" onClick={onConnect}>
          🔌 Controller verbinden
        </button>
      ) : (
        <p className="play-calibration__error">
          Dieser Browser unterstützt keinen Rohzugriff (WebHID). In Chrome oder Edge steht er zur
          Verfügung.
        </p>
      )}

      {error && <p className="play-calibration__error">{error}</p>}

      {devices.length > 0 && (
        <ul className="play-setup__devices">
          {devices.map((device, index) => (
            // Die Position IST die Zuordnung zur Station (erstes Gerät = links).
            // biome-ignore lint/suspicious/noArrayIndexKey: Position ist hier die Identität
            <li key={`${device.deviceKey}-${index}`}>
              <span className="play-setup__station">
                {STATION_LABELS[STATION_IDS[index]] ?? `Gerät ${index + 1}`}
              </span>
              <span className="play-setup__label">{device.label}</span>
              {isCalibrated(device.deviceKey) ? (
                <span className="play-setup__ok">✅ belegt</span>
              ) : (
                <button type="button" className="play-button" onClick={() => onCalibrate(device)}>
                  Tasten festlegen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="play-calibration__progress">
        Die Freigabe merkt sich der Browser – beim nächsten Start entfällt der Dialog.
      </p>
    </section>
  );
}
