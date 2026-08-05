/**
 * Umschalt-State für die /dev-Arena – analog zum bereits etablierten
 * `useWebSocketConnection`-Hook-Muster in diesem Projekt. `DevPage` selbst
 * bleibt dünn/präsentational (siehe design.md, US-8).
 *
 * Keine Bot-Auswahl mehr (siehe `.features/dev-station-mode/`): der
 * Bot-Testlauf verwendet immer deterministisch `client/src/bot/
 * current-bot.js` (`currentBotSource`), keine Auswahl aus mehreren Dateien.
 */
import { useState } from "react";

export type ArenaControlMode = "keyboard" | "bot";

export interface ArenaControls {
  mode: ArenaControlMode;
  setMode: (mode: ArenaControlMode) => void;
}

export function useArenaControls(): ArenaControls {
  // Standardmodus "bot": Am Stand ist "Bot laufen lassen" der Regelfall
  // (Testlauf gegen current-bot.js), "Selbst spielen" ist die Ausnahme zum
  // Level-Ausprobieren.
  const [mode, setMode] = useState<ArenaControlMode>("bot");

  return { mode, setMode };
}
