/**
 * Minimale requestAnimationFrame-Schleife – siehe
 * `.features/play-mode/design.md`. Wird für das Roh-Sampling im
 * Kalibrierungs-Assistenten und für die Phasen-Ticks der Stationen genutzt.
 *
 * Der Callback wird per Ref gehalten, damit eine neue Inline-Funktion pro
 * Render die Schleife nicht ständig neu aufsetzt (Muster wie `ArenaView`).
 *
 * WICHTIG: Der nächste Frame wird VOR dem Callback eingeplant und der Callback
 * gekapselt ausgeführt. Andernfalls beendet eine einzige Exception die Schleife
 * dauerhaft und still – die Gamepad-Eingabe käme danach nie wieder an (siehe
 * `.features/play-mode-dead-loop/bugfix.md`).
 */
import { useEffect, useRef } from "react";

export function useFrameLoop(
  callback: (deltaMs: number) => void,
  enabled = true,
  onError?: (error: unknown) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;

    let frameId = 0;
    let stopped = false;
    let previous: number | null = null;

    const loop = (time: number) => {
      if (stopped) return;

      const deltaMs = previous === null ? 0 : time - previous;
      previous = time;

      // Erst den Folgeframe sichern, dann arbeiten: Die Schleife überlebt
      // damit jeden Fehler im Callback.
      frameId = requestAnimationFrame(loop);

      try {
        callbackRef.current(deltaMs);
      } catch (error) {
        onErrorRef.current?.(error);
        console.error("[play] Fehler in der Frame-Schleife:", error);
      }
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [enabled]);
}
