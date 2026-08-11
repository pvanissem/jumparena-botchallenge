import type { AudioSettingsMessage, BotArtifact } from "@arena/shared";
import type { TournamentSessionSnapshot } from "../tournament/TournamentSessionService";
import type { ConnectedClient } from "./ConnectedClient";

export interface ClientBootstrapSources {
  listBots(): BotArtifact[];
  getAudioSettings(): AudioSettingsMessage;
  getTournamentSession(): TournamentSessionSnapshot;
  now(): number;
}

export function createClientBootstrap(
  sources: ClientBootstrapSources
): (client: ConnectedClient) => void {
  return (client) => {
    client.send({ type: "bot-registry-snapshot", bots: sources.listBots() });
    client.send(sources.getAudioSettings());
    client.send({
      type: "tournament-state",
      ...sources.getTournamentSession(),
      serverNowMs: sources.now(),
    });
  };
}
