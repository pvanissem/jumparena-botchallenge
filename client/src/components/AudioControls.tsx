/**
 * Toggle + Slider für Master-Lautstärke (Musik + SFX) – wiederverwendbar,
 * keine Kenntnis von WebSocket/Broadcast (Single Responsibility), siehe
 * `.features/game-audio/design.md`, Abschnitt "AudioControls.tsx".
 */
import { useAudioSettings } from "../game/audio/useAudioSettings";

export function AudioControls() {
  const { muted, volume, setVolume, toggleMute } = useAudioSettings();

  return (
    <div>
      <button type="button" onClick={toggleMute}>
        {muted ? "Stummschaltung aufheben" : "Stummschalten"}
      </button>
      <input
        type="range"
        role="slider"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label="Lautstärke"
      />
    </div>
  );
}
