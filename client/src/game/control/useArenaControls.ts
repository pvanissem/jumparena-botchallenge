/**
 * Umschalt-/Auswahl-State für die /dev-Arena – analog zum bereits
 * etablierten `useWebSocketConnection`-Hook-Muster in diesem Projekt.
 * `DevPage` selbst bleibt dünn/präsentational (siehe design.md, US-8).
 */
import { useCallback, useState } from "react";

export type ArenaControlMode = "keyboard" | "bot";

export interface ArenaControls {
  mode: ArenaControlMode;
  setMode: (mode: ArenaControlMode) => void;
  selectedBot: string | null;
  selectBot: (botFileName: string) => void;
}

export function useArenaControls(): ArenaControls {
  const [mode, setMode] = useState<ArenaControlMode>("keyboard");
  const [selectedBot, setSelectedBot] = useState<string | null>(null);

  const selectBot = useCallback((botFileName: string) => {
    setSelectedBot(botFileName);
  }, []);

  return { mode, setMode, selectedBot, selectBot };
}
