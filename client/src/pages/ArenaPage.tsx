/**
 * Gemeinsame Arena-Seite für die Einzel-Testläufe – wird in zwei Varianten
 * verwendet (siehe `.features/code-station-page/`):
 *
 * - `/dev`  (DevPage):  Entwickler-Ansicht mit Level-Auswahl und Phaser-
 *                       Physik-Debug-Overlay.
 * - `/code` (CodePage): Messestand-Ansicht – keine Level-Auswahl (immer
 *                       Messelevel), kein Debug-Overlay.
 *
 * Bewusst EINE Komponente mit Varianten-Props statt zwei Kopien (DRY): die
 * Toolbar-Logik (Modus, Neustart, Audio, HUD, Bot-Diagnose, Trace) ist in
 * beiden Varianten identisch.
 */
import { useState } from "react";
import { currentBotSource } from "../bot/currentBotSource";
import { AudioControls } from "../components/AudioControls";
import { FinishOverlay } from "../components/FinishOverlay";
import { HazardLegend } from "../components/HazardLegend";
import { ScoreHud } from "../components/ScoreHud";
import type { ArenaViewStatus } from "../game/ArenaView";
import { ArenaView } from "../game/ArenaView";
import { useAudioUnlockHint } from "../game/audio/useAudioUnlockHint";
import { useArenaControls } from "../game/control/useArenaControls";
import { getLevelById, LEVEL_REGISTRY } from "../game/level/levelRegistry";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { writeBotTrace } from "../game/trace/writeBotTrace";

type BotDiagnosis = Pick<
  ArenaViewStatus,
  | "pausedReasonKind"
  | "pausedReason"
  | "lastRuntimeError"
  | "consecutiveFailureCount"
  | "navigation"
>;

export interface ArenaPageProps {
  /** Blendet die Level-Auswahl ein (Default: Level 1).
   *  Ohne Auswahl bleibt die Messestand-Ansicht beim urspruenglichen Level 1. */
  showLevelSelect?: boolean;
  /** Reicht das Phaser-Arcade-Debug-Overlay an `ArenaView` durch. */
  physicsDebug?: boolean;
}

// Diese Seite dient dem Ausprobieren/Debuggen, nicht der Turnier-Wertung (siehe
// docs/05) - ein begrenztes Leben-Budget würde einen Testlauf nur
// unnötig vorzeitig beenden (didNotFinish, siehe raceRules.ts), sobald der
// Bot ein paar Mal stirbt. Deshalb hier unendlich viele Leben.
const UNLIMITED_LIVES = Number.POSITIVE_INFINITY;

function renderBotDiagnosis(diagnosis: BotDiagnosis): string {
  switch (diagnosis.pausedReasonKind) {
    case "invalid-module":
      return `🔴 Bot ungültig: ${diagnosis.pausedReason}`;
    case "guard-rejected":
      return `🔴 Bot blockiert: ${diagnosis.pausedReason}`;
    case "init-timeout":
      return "🔴 Bot-Start fehlgeschlagen: Zeitlimit bei der Initialisierung";
    case "worker-error":
      return `🔴 Bot-Worker fehlgeschlagen: ${diagnosis.pausedReason}`;
    case "too-many-failures":
      return `🔴 ${diagnosis.pausedReason ?? "Bot gestoppt: Entscheidung fehlgeschlagen"}`;
    case "disposed":
      return "🔴 Bot beendet";
    case null:
      return "🟢 Bot läuft";
  }
}

export function ArenaPage({ showLevelSelect = false, physicsDebug = false }: ArenaPageProps) {
  const { mode, setMode, levelId, setLevelId } = useArenaControls();
  const [startCheckpointId, setStartCheckpointId] = useState("");
  const checkpoints = getLevelById(levelId).checkpoints;
  // Browser-Autoplay-Policy: Lautstärke/Mute wirken sich erst hörbar aus,
  // sobald der AudioContext durch eine Nutzer-Geste entsperrt wurde (siehe
  // `.features/game-audio-unlock-hint/bugfix.md`). Bis dahin scheint der
  // Regler "nicht live" zu reagieren, obwohl der Store bereits korrekt
  // aktualisiert wird.
  const audioLocked = useAudioUnlockHint();
  const [racer, setRacer] = useState<RacerRuntimeState | null>(null);
  const [diagnosis, setDiagnosis] = useState<BotDiagnosis | null>(null);
  // Erhöht sich bei Klick auf "Neu starten" und wird als React-`key` an
  // `ArenaView` gegeben, damit die Komponente komplett neu gemountet wird
  // (zerstört das alte Phaser-Game sauber und startet die Szene mit frischem
  // `create()`/Racer-State neu, siehe ArenaView.tsx Cleanup-Effect).
  const [runId, setRunId] = useState(0);
  const [sessionId, setSessionId] = useState(() => new Date().toISOString());
  const [traceStatus, setTraceStatus] = useState<"saved" | "error" | null>(null);

  // Gemeinsamer Reset-Mechanismus für "↻ Neu", einen Levelwechsel (US-4) UND
  // den "Nochmal"-Button im FinishOverlay: alle sollen den Lauf identisch
  // zurücksetzen (Racer/Coins/Leben/Zeit), der bereits bestehende
  // `key`-Remount-Mechanismus übernimmt das (DRY).
  const restart = () => {
    setRacer(null);
    setDiagnosis(null);
    setTraceStatus(null);
    setSessionId(new Date().toISOString());
    setRunId((id) => id + 1);
  };

  const runEnded = racer != null && (racer.finished || racer.didNotFinish);

  return (
    <main className="pixel-page">
      <div className="pixel-shell">
        <div className="pixel-bar">
          <div className="pixel-toggle">
            <label
              className={`pixel-toggle__option${
                mode === "keyboard" ? " pixel-toggle__option--active" : ""
              }`}
            >
              <input
                type="radio"
                checked={mode === "keyboard"}
                onChange={() => setMode("keyboard")}
              />
              🎮 Selbst
            </label>
            <label
              className={`pixel-toggle__option${
                mode === "bot" ? " pixel-toggle__option--active" : ""
              }`}
            >
              <input type="radio" checked={mode === "bot"} onChange={() => setMode("bot")} />🤖 Bot
            </label>
          </div>

          {showLevelSelect && (
            <select
              className="pixel-select"
              aria-label="Level"
              value={levelId}
              onChange={(e) => {
                setLevelId(e.target.value);
                setStartCheckpointId("");
                restart();
              }}
            >
              {LEVEL_REGISTRY.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          )}

          <select
            className="pixel-select"
            aria-label="Startpunkt"
            value={startCheckpointId}
            onChange={(event) => {
              setStartCheckpointId(event.target.value);
              restart();
            }}
          >
            <option value="">Start: Levelanfang</option>
            {checkpoints.map((checkpoint, index) => (
              <option key={checkpoint.id} value={checkpoint.id}>
                Start: Checkpoint {index + 1} (x={checkpoint.x})
              </option>
            ))}
          </select>

          <button type="button" className="pixel-btn pixel-btn--accent" onClick={restart}>
            ↻ Neu
          </button>

          <AudioControls />
          {audioLocked && (
            <span
              className="pixel-status"
              title="Browser-Autoplay-Policy: Ton startet mit der ersten Interaktion"
            >
              🔈 Ton startet mit der ersten Interaktion
            </span>
          )}

          {racer && <ScoreHud racer={racer} />}

          {mode === "bot" && diagnosis && (
            <span className="pixel-status">{renderBotDiagnosis(diagnosis)}</span>
          )}
          {physicsDebug && mode === "bot" && diagnosis?.navigation && (
            <span className="pixel-status">
              Auftrag: {diagnosis.navigation.planId ?? "–"} · Phase: {diagnosis.navigation.phase} ·
              Grund: {diagnosis.navigation.reason}
            </span>
          )}
          {mode === "bot" && traceStatus === "saved" && (
            <span className="pixel-status">📝 Trace gespeichert</span>
          )}
          {mode === "bot" && traceStatus === "error" && (
            <span className="pixel-status">🟠 Trace konnte nicht gespeichert werden</span>
          )}
        </div>

        <div className="pixel-arena">
          <ArenaView
            key={runId}
            controlMode={mode}
            levelId={levelId}
            physicsDebug={physicsDebug}
            botSourceCode={mode === "bot" ? currentBotSource : undefined}
            startingLives={UNLIMITED_LIVES}
            startCheckpointId={startCheckpointId || undefined}
            telemetry={
              mode === "bot"
                ? {
                    sessionId,
                    onTrace: (trace) => {
                      void writeBotTrace(trace).then(
                        () => setTraceStatus("saved"),
                        () => setTraceStatus("error")
                      );
                    },
                  }
                : undefined
            }
            onStatusChange={(s) => {
              setRacer(s.racer);
              setDiagnosis({
                pausedReasonKind: s.pausedReasonKind,
                pausedReason: s.pausedReason,
                lastRuntimeError: s.lastRuntimeError,
                consecutiveFailureCount: s.consecutiveFailureCount,
                navigation: s.navigation,
              });
            }}
          />
          {runEnded && racer && <FinishOverlay racer={racer} onRestart={restart} />}
        </div>

        <HazardLegend />
      </div>
    </main>
  );
}
