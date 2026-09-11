/**
 * `/play` – Selber spielen mit Gamepad. Siehe
 * `.features/play-mode/requirements.md` / `design.md` sowie
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Zwei vollständig unabhängige Stationen teilen sich nur Canvas und
 * Bestenliste. Die Eingabe läuft über den Rohzugriff (WebHID): Chromiums
 * Gamepad-Mapping ist für die am Stand verwendeten Adapter unvollständig –
 * links/rechts kommen dort gar nicht an (gemessen, siehe bugfix.md).
 */
import type Phaser from "phaser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AudioControls } from "../components/AudioControls";
import { useAudioUnlockHint } from "../game/audio/useAudioUnlockHint";
import { HighscorePanel } from "../play/HighscorePanel";
import { type HighscoreEntry, insertHighscore } from "../play/highscore";
import { highscoreStore } from "../play/highscoreStore";
import { HidCalibrationWizard } from "../play/input/hid/HidCalibrationWizard";
import { HidController } from "../play/input/hid/HidController";
import type { HidMapping } from "../play/input/hid/hidMapping";
import { hidMappingStore } from "../play/input/hid/hidMappingStore";
import {
  STATION_IDS,
  STATION_LABELS,
  STATION_SHORT_LABELS,
  type StationId,
} from "../play/input/inputs";
import { PlayArena } from "../play/PlayArena";
import { PlaySetup } from "../play/PlaySetup";
import { StationOverlay } from "../play/StationOverlay";
import { StationSceneHost } from "../play/StationSceneHost";
import { levelsCompleted, type StationState } from "../play/station";
import { deviceForStation, type HidStationDevice, useHidDevices } from "../play/useHidDevices";
import { useStation } from "../play/useStation";
import { useStationInputLoop } from "../play/useStationInputLoop";
import "../styles/play-arcade.css";

export function PlayPage() {
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const [entries, setEntries] = useState<HighscoreEntry[]>(() => highscoreStore.load());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const audioLocked = useAudioUnlockHint();

  const hid = useHidDevices();
  const [hidMappings, setHidMappings] = useState<Record<string, HidMapping>>(() =>
    hidMappingStore.all()
  );
  const [calibrating, setCalibrating] = useState<HidStationDevice | null>(null);

  const host = useMemo(() => (game ? new StationSceneHost(game) : null), [game]);
  useEffect(() => () => host?.destroy(), [host]);

  /** Fertige Steuerquellen je Station – nur für kalibrierte Geräte. */
  const controllers = useMemo(() => {
    const result: Record<StationId, HidController | null> = { left: null, right: null };
    for (const stationId of STATION_IDS) {
      const device = deviceForStation(hid.devices, stationId);
      const mapping = device ? hidMappings[device.deviceKey] : null;
      result[stationId] = device && mapping ? new HidController(device.source, mapping) : null;
    }
    return result;
  }, [hid.devices, hidMappings]);

  const saveMapping = useCallback((mapping: HidMapping) => {
    hidMappingStore.save(mapping);
    setHidMappings((current) => ({ ...current, [mapping.deviceKey]: mapping }));
    setCalibrating(null);
  }, []);

  const recordRun = useCallback((state: StationState) => {
    const entry: HighscoreEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: state.name,
      score: state.totalScore,
      levelsCompleted: levelsCompleted(state),
      createdAt: Date.now(),
    };
    const result = insertHighscore(highscoreStore.load(), entry);
    highscoreStore.save(result.entries);
    setEntries(result.entries);
    setHighlightId(entry.id);
    return result.rank;
  }, []);

  if (calibrating) {
    return (
      <main className="play-page play-page--calibrating">
        <HidCalibrationWizard
          source={calibrating.source}
          deviceKey={calibrating.deviceKey}
          label={calibrating.label}
          stationLabel={
            deviceForStation(hid.devices, "left") === calibrating
              ? STATION_LABELS.left
              : STATION_LABELS.right
          }
          onComplete={saveMapping}
          onCancel={() => setCalibrating(null)}
        />
      </main>
    );
  }

  // Solange keine Station eine kalibrierte Quelle hat, führt der
  // Einrichtungs-Bildschirm durch die Einrichtung.
  if (!controllers.left && !controllers.right) {
    return (
      <main className="play-page play-page--calibrating">
        <PlaySetup
          supported={hid.supported}
          devices={hid.devices}
          isCalibrated={(deviceKey) => !!hidMappings[deviceKey]}
          error={hid.error}
          onConnect={() => void hid.requestDevice()}
          onCalibrate={setCalibrating}
        />
      </main>
    );
  }

  return (
    <main className="play-page">
      <header className="play-page__header">
        <h1 className="play-page__title">
          <span className="play-page__title-mark">DEVK</span>
          <span className="play-page__title-main">AI Bot Challenge</span>
        </h1>

        {/* Anschluss & Ton belegen im Betrieb keinen Platz – erst auf Klick. */}
        <details className="play-page__panel" data-testid="controller-panel">
          <summary className="play-page__panel-summary">
            🎮 Controller &amp; Ton
            <span className="play-page__panel-count">{hid.devices.length}</span>
            {audioLocked && <span className="play-page__audio-hint">🔇 Ton</span>}
          </summary>
          <div className="play-page__tools">
            <AudioControls />
            {hid.supported && (
              <button
                type="button"
                className="play-button"
                onClick={() => void hid.requestDevice()}
              >
                🔌 Controller verbinden
              </button>
            )}
            {hid.devices.map((device, index) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: Position ist die Zuordnung zur Station
                key={`${device.deviceKey}-${index}`}
                type="button"
                className="play-button play-button--ghost"
                onClick={() => setCalibrating(device)}
              >
                ⚙ {STATION_SHORT_LABELS[STATION_IDS[index]] ?? `Gerät ${index + 1}`} ·{" "}
                {device.label}
              </button>
            ))}
          </div>
        </details>
      </header>

      <div className="play-page__stage">
        <PlayArena className="play-page__canvas" onReady={setGame} />
        <div className="play-page__overlays">
          {host &&
            STATION_IDS.map((stationId) => (
              <Station
                key={stationId}
                stationId={stationId}
                host={host}
                controller={controllers[stationId]}
                deviceLabel={deviceForStation(hid.devices, stationId)?.label ?? null}
                onRunFinished={recordRun}
              />
            ))}
        </div>
      </div>

      <HighscorePanel entries={entries} highlightId={highlightId} />
    </main>
  );
}

interface StationProps {
  stationId: StationId;
  host: StationSceneHost;
  /** Kalibrierte Steuerquelle, oder `null` wenn diese Station unbelegt ist. */
  controller: HidController | null;
  deviceLabel: string | null;
  onRunFinished: (state: StationState) => number | null;
}

/** Eine Station: eigener Reducer, eigene Szene, eigener Controller. */
function Station({ stationId, host, controller, deviceLabel, onRunFinished }: StationProps) {
  const [connected, setConnected] = useState(true);

  const station = useStation({
    stationId,
    host,
    humanInput: controller,
    connected,
    onRunFinished,
  });

  // EINE Frame-Schleife für Eingaben UND Phasen-Zeiten. Eingaben werden in
  // jedem Frame gepollt, Ticks nur in zeitgesteuerten Phasen und dort
  // gedrosselt – siehe `.features/play-mode-input-lag/bugfix.md`.
  useStationInputLoop({
    source: controller,
    phase: station.state.phase,
    onEdges: station.handleEdges,
    onTick: station.tick,
    onConnectionChange: setConnected,
  });

  if (!controller) {
    return (
      <div className={`play-station play-station--${stationId}`} data-phase="unassigned">
        <div className="play-overlay play-overlay--attract">
          <h2 className="play-overlay__title">
            {deviceLabel ? "Controller noch nicht belegt" : "Kein Controller zugeordnet"}
          </h2>
          <p className="play-overlay__hint">
            {deviceLabel
              ? `Oben rechts „⚙ ${deviceLabel}“ wählen und die Tasten festlegen.`
              : "Oben rechts über „🔌 Controller verbinden“ ein Gamepad einrichten."}
          </p>
        </div>
      </div>
    );
  }

  return <StationOverlay stationId={stationId} state={station.state} racer={station.racer} />;
}
