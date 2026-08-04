/**
 * Erkennt die erste Nutzer-Interaktion (Klick/Touch/Tastendruck) auf der
 * Seite, damit die UI transparent machen kann, dass Audio-Wiedergabe erst ab
 * diesem Zeitpunkt möglich ist (Browser-Autoplay-Policy, siehe
 * `.features/game-audio-unlock-hint/bugfix.md`). Bewusst unabhängig von
 * Phasers eigenem Unlock-Mechanismus (der bereits denselben Zeitpunkt nutzt,
 * siehe `WebAudioSoundManager#unlock`) – dieser Hook dient nur der
 * UI-Anzeige, nicht der eigentlichen Audio-Freischaltung.
 */
import { useEffect, useState } from "react";

export function useAudioUnlockHint(): boolean {
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    if (!locked) return;

    const unlock = () => setLocked(false);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [locked]);

  return locked;
}
