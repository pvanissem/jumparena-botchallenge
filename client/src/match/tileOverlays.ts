import type { RacerRuntimeState } from "../game/rules/racerState";
import type { BotRunnerPauseReasonKind } from "../sandbox/BotRunner";
import type { ViewportRect } from "./gridViewports";
import { deriveRacerOutcome, type RacerOutcome } from "./racerOutcome";

export interface TileOverlayDescriptor {
  botId: string;
  name: string;
  color: string;
  playerNumber: number;
  viewport: ViewportRect;
  outcome: RacerOutcome | null;
  racer: RacerRuntimeState | null;
  isWinner: boolean;
}

export interface TileOverlaySlot {
  botId: string;
  name: string;
  color: string;
  viewport: ViewportRect;
  racer: RacerRuntimeState | null;
  pausedReasonKind: BotRunnerPauseReasonKind | null;
}

/**
 * Berechnet aus den Slots und dem optionalen Sieger die Overlays, die in
 * `/present` pro Racer-Kachel angezeigt werden sollen. Nur Racer mit einem
 * Endzustand erzeugen einen Deskriptor; `isWinner` ist genau dann `true`, wenn
 * `winnerBotId` gesetzt ist und mit `botId` übereinstimmt.
 */
export function computeTileOverlays(input: {
  slots: readonly TileOverlaySlot[];
  winnerBotId: string | null;
}): TileOverlayDescriptor[] {
  return input.slots.map((slot, index) => {
    const outcome = slot.racer ? deriveRacerOutcome(slot.racer, slot.pausedReasonKind) : null;
    return {
      botId: slot.botId,
      name: slot.name,
      color: slot.color,
      playerNumber: index + 1,
      viewport: slot.viewport,
      outcome,
      racer: slot.racer,
      isWinner: input.winnerBotId === slot.botId,
    };
  });
}
