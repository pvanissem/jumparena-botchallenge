/**
 * EINE Frame-Schleife je Station: Polling, Flankenerkennung, Verbindungs-
 * prüfung und Phasen-Ticks gebündelt – siehe
 * `.features/play-mode-input-lag/bugfix.md`.
 *
 * Warum gebündelt und gedrosselt:
 * Zuvor liefen zwei rAF-Schleifen pro Station, und die Phasen-Ticks feuerten in
 * JEDEM Frame. Da `stationReducer` für einen Tick immer ein neues State-Objekt
 * liefert, rendert React dann 60x/s pro Station neu – zusammen mit Phasers
 * eigener Schleife bricht die Poll-Frequenz ein, und kurze Tastendrücke, die
 * zwischen zwei Polls beginnen und enden, gehen komplett verloren.
 *
 * Deshalb:
 * - Eingaben werden weiterhin in JEDEM Frame gepollt (Flanken sind selten und
 *   lösen daher kaum Re-Renders aus).
 * - Ticks laufen nur in Phasen, die tatsächlich auf Zeit warten, und dort auf
 *   einem 100-ms-Raster mit verlustfrei akkumuliertem Delta.
 */
import { useRef } from "react";
import { hasAnyInput, type InputSnapshot, risingEdges } from "./input/inputSnapshot";
import type { StationPhase } from "./station";
import { useFrameLoop } from "./useFrameLoop";

/** Raster für zeitgesteuerte Phasen – 10 Hz reicht für Sekundenanzeigen. */
export const STATION_TICK_INTERVAL_MS = 100;

/** Nur diese Phasen warten auf Zeit; alle anderen brauchen keinen Tick. */
const TIMED_PHASES: readonly StationPhase[] = ["countdown", "level-result", "game-over"];

/**
 * Eingabequelle einer Station. Bewusst minimal gehalten, damit weitere
 * Quellen (heute: `HidController`) sie ohne Anpassung erfüllen können – die
 * Station kennt den Unterschied nicht.
 */
export interface StationInputSource {
  snapshot(): InputSnapshot | null;
  isConnected(): boolean;
}

export interface UseStationInputLoopOptions {
  source: StationInputSource | null;
  phase: StationPhase;
  onEdges: (edges: InputSnapshot) => void;
  onTick: (deltaMs: number) => void;
  onConnectionChange: (connected: boolean) => void;
}

export function useStationInputLoop({
  source,
  phase,
  onEdges,
  onTick,
  onConnectionChange,
}: UseStationInputLoopOptions): void {
  const previousRef = useRef<InputSnapshot | null>(null);
  const accumulatedRef = useRef(0);
  const connectedRef = useRef(true);

  useFrameLoop((deltaMs) => {
    if (!source) return;

    const snapshot = source.snapshot();

    // Verbindungsstatus nur bei ÄNDERUNG melden – sonst entstünde erneut ein
    // State-Update pro Frame.
    const connected = source.isConnected() && snapshot !== null;
    if (connected !== connectedRef.current) {
      connectedRef.current = connected;
      onConnectionChange(connected);
    }

    if (snapshot) {
      const edges = risingEdges(previousRef.current, snapshot);
      previousRef.current = snapshot;
      if (hasAnyInput(edges)) onEdges(edges);
    } else {
      previousRef.current = null;
    }

    if (!TIMED_PHASES.includes(phase)) {
      accumulatedRef.current = 0;
      return;
    }

    accumulatedRef.current += deltaMs;
    if (accumulatedRef.current >= STATION_TICK_INTERVAL_MS) {
      const elapsed = accumulatedRef.current;
      accumulatedRef.current = 0;
      onTick(elapsed);
    }
  });
}
