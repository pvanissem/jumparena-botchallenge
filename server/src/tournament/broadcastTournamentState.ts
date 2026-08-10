import type { OutboundMessage } from "@arena/shared";
import type { TournamentService } from "./TournamentService";

/**
 * Gibt eine Funktion zurück, die den aktuellen Turnierzustand an alle Clients
 * sendet. Wird von allen mutierenden Turnier-Handlern wiederverwendet (DRY).
 */
export function createTournamentStateBroadcaster(
  service: TournamentService,
  broadcastAll: (message: OutboundMessage) => void
): () => void {
  return () => broadcastAll({ type: "tournament-state", state: service.getState() });
}
