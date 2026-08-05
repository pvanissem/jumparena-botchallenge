/**
 * Toggle + Slider für Master-Lautstärke (Musik + SFX) – wiederverwendbar,
 * keine Kenntnis von WebSocket/Broadcast (Single Responsibility), siehe
 * `.features/game-audio/design.md`, Abschnitt "AudioControls.tsx".
 */
import { useAudioSettings } from "../game/audio/useAudioSettings";

export function AudioControls() {
  const { muted, volume, setVolume, toggleMute } = useAudioSettings();

  return (
    <div className="pixel-audio">
      <button type="button" className="pixel-btn" onClick={toggleMute}>
        {muted ? "🔇 Stummschaltung aufheben" : "🔊 Stummschalten"}
      </button>
      <span className="pixel-audio__label">Lautstärke</span>
      <input
        type="range"
        role="slider"
        className="pixel-range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label="Lautstärke"
      />
    </div>
  );
}
