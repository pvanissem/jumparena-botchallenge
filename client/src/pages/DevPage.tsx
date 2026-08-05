import { useState } from "react";
import { currentBotSource } from "../bot/currentBotSource";
import { AudioControls } from "../components/AudioControls";
import type { ArenaViewStatus } from "../game/ArenaView";
import { ArenaView } from "../game/ArenaView";
import { useAudioUnlockHint } from "../game/audio/useAudioUnlockHint";
import { useArenaControls } from "../game/control/useArenaControls";
import type { RacerRuntimeState } from "../game/rules/racerState";

type BotDiagnosis = Pick<
  ArenaViewStatus,
  "pausedReasonKind" | "pausedReason" | "lastRuntimeError" | "consecutiveFailureCount"
>;

function renderBotDiagnosis(diagnosis: BotDiagnosis): string {
  switch (diagnosis.pausedReasonKind) {
    case "invalid-module":
      return `🔴 Bot ungültig: ${diagnosis.pausedReason}`;
    case "guard-rejected":
      return `🔴 Bot blockiert: ${diagnosis.pausedReason}`;
    case "too-many-failures":
      return "🔴 Bot pausiert: reagiert nicht rechtzeitig / wirft wiederholt Fehler";
    case "disposed":
      return "🔴 Bot beendet";
    case null:
      return diagnosis.lastRuntimeError
        ? `🟠 Bot läuft, wirft aber Fehler: ${diagnosis.lastRuntimeError} (${diagnosis.consecutiveFailureCount}/10 in Folge)`
        : "🟢 Bot läuft";
  }
}

export function DevPage() {
  const { mode, setMode } = useArenaControls();
  const [racer, setRacer] = useState<RacerRuntimeState | null>(null);
  const [diagnosis, setDiagnosis] = useState<BotDiagnosis | null>(null);
  const audioLocked = useAudioUnlockHint();
  // Erhöht sich bei Klick auf "Neu starten" und wird als React-`key` an
  // `ArenaView` gegeben, damit die Komponente komplett neu gemountet wird
  // (zerstört das alte Phaser-Game sauber und startet die Szene mit frischem
  // `create()`/Racer-State neu, siehe ArenaView.tsx Cleanup-Effect).
  const [runId, setRunId] = useState(0);

  return (
    <main>
      <h1>Bot-Entwicklung</h1>
      <p>
        Die eigentliche Bot-Entwicklung (devkcode) ist nicht Teil dieses Features. Hier kann das
        Level selbst getestet werden – entweder manuell oder mit dem aktuellen Bot (
        <code>client/src/bot/current-bot.js</code>). Änderungen an dieser Datei lösen automatisch
        einen Reload dieser Seite aus.
      </p>
      <AudioControls />
      {audioLocked && (
        <p>🔈 Ton startet mit der ersten Interaktion (Klick/Taste) – Vorgabe des Browsers.</p>
      )}

      <section>
        <h2>Level testen</h2>
        <label>
          <input type="radio" checked={mode === "keyboard"} onChange={() => setMode("keyboard")} />
          Selbst spielen
        </label>
        <label>
          <input type="radio" checked={mode === "bot"} onChange={() => setMode("bot")} />
          Bot laufen lassen
        </label>

        <button
          type="button"
          onClick={() => {
            setRacer(null);
            setDiagnosis(null);
            setRunId((id) => id + 1);
          }}
        >
          Neu starten
        </button>

        {mode === "bot" && diagnosis && <p>{renderBotDiagnosis(diagnosis)}</p>}
        {racer && (
          <p>
            Coins: {racer.coinsCollected} · Leben: {racer.livesRemaining} · Zeit:{" "}
            {Math.round(racer.timeElapsedMs / 1000)}s
          </p>
        )}

        <ArenaView
          key={runId}
          controlMode={mode}
          botSourceCode={mode === "bot" ? currentBotSource : undefined}
          onStatusChange={(s) => {
            setRacer(s.racer);
            setDiagnosis({
              pausedReasonKind: s.pausedReasonKind,
              pausedReason: s.pausedReason,
              lastRuntimeError: s.lastRuntimeError,
              consecutiveFailureCount: s.consecutiveFailureCount,
            });
          }}
        />
      </section>
    </main>
  );
}
