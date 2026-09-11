/**
 * Verdrahtet den puren `stationReducer` mit den Phaser-Szenen EINER Station –
 * siehe `.features/play-mode/design.md`, Sequenz "Ein Run" (US-4, US-5).
 *
 * Die Trennung ist bewusst: Alle Entscheidungen fallen im Reducer, dieser Hook
 * führt nur die daraus folgenden Seiteneffekte aus (Level starten/stoppen,
 * pausieren) und hält den Live-Zustand der laufenden Szene für das HUD.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { HumanInputSource } from "../game/control/RacerController";
import { isRacerTerminal, type RacerRuntimeState } from "../game/rules/racerState";
import type { InputSnapshot } from "./input/inputSnapshot";
import type { StationId } from "./input/inputs";
import type { StationSceneHost } from "./StationSceneHost";
import { createStationState, PLAY_LEVEL_IDS, type StationState, stationReducer } from "./station";

export interface UseStationOptions {
  stationId: StationId;
  host: StationSceneHost;
  /** `null`, solange die Station keine kalibrierte Quelle hat. */
  humanInput: HumanInputSource | null;
  /** Ob das zugeordnete Gamepad aktuell verbunden ist (US-3). */
  connected: boolean;
  /** Wird genau einmal je beendetem Run aufgerufen (Bestenliste, US-6).
   *  Der Rückgabewert ist die Platzierung (oder `null` außerhalb der Top 10)
   *  und wird direkt in den Stationszustand übernommen. */
  onRunFinished: (state: StationState) => number | null | undefined;
}

export interface UseStationResult {
  state: StationState;
  /** Live-Zustand der laufenden Szene (null außerhalb eines Levels). */
  racer: RacerRuntimeState | null;
  handleEdges: (edges: InputSnapshot) => void;
  tick: (deltaMs: number) => void;
}

export function useStation({
  stationId,
  host,
  humanInput,
  connected,
  onRunFinished,
}: UseStationOptions): UseStationResult {
  const [state, dispatch] = useReducer(stationReducer, undefined, createStationState);
  const [racer, setRacer] = useState<RacerRuntimeState | null>(null);
  const { phase, levelIndex } = state;

  // Ein Level darf sein Ende nur EINMAL melden: `onStatusChange` feuert
  // mehrmals pro Sekunde weiter, auch nachdem der Racer terminal ist.
  const levelEndedRef = useRef(false);
  const runningLevelRef = useRef<string | null>(null);
  const onRunFinishedRef = useRef(onRunFinished);
  onRunFinishedRef.current = onRunFinished;

  const handleEdges = useCallback((edges: InputSnapshot) => {
    dispatch({ type: "input", edges });
  }, []);

  const tick = useCallback((deltaMs: number) => {
    dispatch({ type: "tick", deltaMs });
  }, []);

  // Level starten/stoppen als Folge der Reducer-Phase. Dependencies bewusst
  // eng gefasst (NICHT das ganze `state`-Objekt): Sonst liefe dieser Effekt bei
  // jedem Tick erneut – siehe `.features/play-mode-input-lag/bugfix.md`.
  const livesRef = useRef(state.livesRemaining);
  livesRef.current = state.livesRemaining;

  useEffect(() => {
    const levelId = PLAY_LEVEL_IDS[Math.min(levelIndex, PLAY_LEVEL_IDS.length - 1)];

    if (!humanInput) return;

    if (phase === "playing" && runningLevelRef.current !== levelId) {
      runningLevelRef.current = levelId;
      levelEndedRef.current = false;
      setRacer(null);

      host.startLevel({
        stationId,
        levelId,
        startingLives: livesRef.current,
        humanInput,
        onStatusChange: ({ racer: next }) => {
          setRacer(next);
          if (levelEndedRef.current || !isRacerTerminal(next)) return;
          levelEndedRef.current = true;
          dispatch({ type: "level-ended", racer: next });
        },
      });
      return;
    }

    // Jede Phase außerhalb des Spiels (Ergebnis, Game Over, Abbruch) beendet
    // die Szene dieser Station – die andere bleibt unberührt.
    if (phase !== "playing" && phase !== "disconnected" && runningLevelRef.current) {
      runningLevelRef.current = null;
      setRacer(null);
      host.stopLevel(stationId);
    }
  }, [host, humanInput, phase, levelIndex, stationId]);

  // Gamepad-Verlust: nur diese Station pausieren (US-3/US-5).
  useEffect(() => {
    if (!connected && state.phase === "playing") {
      host.pause(stationId);
      dispatch({ type: "gamepad-lost" });
    } else if (connected && state.phase === "disconnected") {
      host.resume(stationId);
      dispatch({ type: "gamepad-found" });
    }
  }, [connected, host, state.phase, stationId]);

  // Ergebnis eines beendeten Runs genau einmal nach außen melden. Der Vergleich
  // läuft über ein Flag, NICHT über die State-Identität: In `game-over` erzeugt
  // jeder Tick (Timeout-Countdown) ein neues State-Objekt.
  const runReportedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "game-over") {
      runReportedRef.current = false;
      return;
    }
    if (runReportedRef.current) return;
    runReportedRef.current = true;
    const rank = onRunFinishedRef.current(state);
    if (rank !== undefined) dispatch({ type: "rank-assigned", rank });
  }, [state]);

  return { state, racer, handleEdges, tick };
}
