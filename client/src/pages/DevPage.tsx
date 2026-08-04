import { useEffect, useState } from "react";
import { AudioControls } from "../components/AudioControls";
import { BroadcastFeed } from "../components/BroadcastFeed";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { ArenaView } from "../game/ArenaView";
import { useAudioUnlockHint } from "../game/audio/useAudioUnlockHint";
import { EXAMPLE_BOTS } from "../game/control/exampleBots";
import { useArenaControls } from "../game/control/useArenaControls";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function DevPage() {
  const { status, lastMessage } = useWebSocketConnection();
  const { mode, setMode, selectedBot, selectBot } = useArenaControls();
  const [botSourceCode, setBotSourceCode] = useState<string | undefined>(undefined);
  const [pausedReason, setPausedReason] = useState<string | null>(null);
  const [racer, setRacer] = useState<RacerRuntimeState | null>(null);
  const audioLocked = useAudioUnlockHint();

  useEffect(() => {
    if (mode !== "bot" || !selectedBot) {
      setBotSourceCode(undefined);
      return;
    }
    let cancelled = false;
    fetch(`/example-bots/${selectedBot}`)
      .then((res) => res.text())
      .then((code) => {
        if (!cancelled) setBotSourceCode(code);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedBot]);

  return (
    <main>
      <h1>Bot-Entwicklung</h1>
      <p>
        Die eigentliche Bot-Entwicklung (devkcode) ist nicht Teil dieses Features. Hier kann das
        Level selbst getestet werden – entweder manuell oder mit einem Beispiel-Bot.
      </p>
      <ConnectionStatusBadge status={status} />
      <BroadcastFeed lastMessage={lastMessage} />
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

        {mode === "bot" && (
          <select value={selectedBot ?? ""} onChange={(e) => selectBot(e.target.value)}>
            <option value="" disabled>
              Bot auswählen…
            </option>
            {EXAMPLE_BOTS.map((bot) => (
              <option key={bot} value={bot}>
                {bot}
              </option>
            ))}
          </select>
        )}

        {pausedReason && <p>Bot pausiert: {pausedReason}</p>}
        {racer && (
          <p>
            Coins: {racer.coinsCollected} · Leben: {racer.livesRemaining} · Zeit:{" "}
            {Math.round(racer.timeElapsedMs / 1000)}s
          </p>
        )}

        {(mode === "keyboard" || botSourceCode) && (
          <ArenaView
            controlMode={mode}
            botSourceCode={botSourceCode}
            onStatusChange={(s) => {
              setRacer(s.racer);
              setPausedReason(s.pausedReason);
            }}
          />
        )}
      </section>
    </main>
  );
}
