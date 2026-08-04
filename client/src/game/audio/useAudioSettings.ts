/**
 * React-Adapter für den purern `audioSettings`-Store. Dünner Wrapper ohne
 * eigene Logik (kein separater Unit-Test nötig – Verhalten wird über
 * `AudioControls.test.tsx` abgedeckt, siehe
 * `.features/game-audio/design.md` / `tasks.md` Task 2.1).
 */
import { useSyncExternalStore } from "react";
import { audioSettings } from "./audioSettings";

export function useAudioSettings() {
  const state = useSyncExternalStore(audioSettings.subscribe, audioSettings.getState);
  return {
    ...state,
    setVolume: audioSettings.setVolume,
    toggleMute: audioSettings.toggleMute,
  };
}
