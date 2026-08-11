import { randomUUID } from "node:crypto";
import { AudioSettingsStore } from "./audio/AudioSettingsStore";
import { createAudioSettingsHandler } from "./audio/createAudioSettingsHandler";
import { BotRegistry } from "./botRegistry/BotRegistry";
import { createBotAddHandler } from "./botRegistry/handlers/createBotAddHandler";
import { createBotRemoveHandler } from "./botRegistry/handlers/createBotRemoveHandler";
import { loadConfig } from "./config";
import { createDevServer } from "./http/createDevServer";
import { createStaticServer } from "./http/createStaticServer";
import { createClientRegisterHandler } from "./tournament/handlers/createClientRegisterHandler";
import { createMatchProgressHandler } from "./tournament/handlers/createMatchProgressHandler";
import { createMatchResultHandler } from "./tournament/handlers/createMatchResultHandler";
import { createPresentReadyHandler } from "./tournament/handlers/createPresentReadyHandler";
import { createTournamentConfigureHandler } from "./tournament/handlers/createTournamentConfigureHandler";
import { createTournamentResetHandler } from "./tournament/handlers/createTournamentResetHandler";
import { createTournamentShowControlHandler } from "./tournament/handlers/createTournamentShowControlHandler";
import { SingleEliminationStrategy } from "./tournament/SingleEliminationStrategy";
import { TournamentService } from "./tournament/TournamentService";
import { TournamentSessionService } from "./tournament/TournamentSessionService";
import { BroadcastRouter } from "./ws/BroadcastRouter";
import { ClientRegistry } from "./ws/ClientRegistry";
import { createClientBootstrap } from "./ws/createClientBootstrap";
import { createBroadcastRelayHandler } from "./ws/handlers/createBroadcastRelayHandler";
import { MessageDispatcher } from "./ws/MessageDispatcher";
import { WebSocketGateway } from "./ws/WebSocketGateway";

const config = loadConfig();

const registry = new ClientRegistry();
const broadcastRouter = new BroadcastRouter(registry);
const dispatcher = new MessageDispatcher();
dispatcher.register("ping-broadcast", createBroadcastRelayHandler(broadcastRouter));
const audioSettings = new AudioSettingsStore();
dispatcher.register(
  "audio-settings",
  createAudioSettingsHandler(audioSettings, (senderId, message) =>
    broadcastRouter.route(senderId, message)
  )
);

const botRegistry = new BotRegistry();
dispatcher.register(
  "bot-add",
  createBotAddHandler(botRegistry, (message) => broadcastRouter.routeToAll(message))
);
dispatcher.register(
  "bot-remove",
  createBotRemoveHandler(botRegistry, (message) => broadcastRouter.routeToAll(message))
);

const tournamentService = new TournamentService(botRegistry, new SingleEliminationStrategy());
const clock = { now: () => Date.now() };
const scheduler = {
  set: (delayMs: number, callback: () => void) => setTimeout(callback, delayMs),
  clear: (handle: unknown) => clearTimeout(handle as NodeJS.Timeout),
};
const tournamentSession = new TournamentSessionService({
  tournament: tournamentService,
  readyPresentClients: registry,
  clock,
  scheduler,
  createAttemptId: randomUUID,
  publishSnapshot: (message) => broadcastRouter.routeToAll(message),
});

dispatcher.register(
  "tournament-configure",
  createTournamentConfigureHandler(tournamentSession, registry)
);
dispatcher.register("tournament-reset", createTournamentResetHandler(tournamentSession, registry));
dispatcher.register("match-result", createMatchResultHandler(tournamentSession));
dispatcher.register(
  "match-progress",
  createMatchProgressHandler(tournamentSession, (message) => broadcastRouter.routeToAll(message))
);
dispatcher.register(
  "tournament-show-control",
  createTournamentShowControlHandler(tournamentSession, registry)
);
dispatcher.register("present-ready", createPresentReadyHandler(registry, tournamentSession));
dispatcher.register(
  "client-register",
  createClientRegisterHandler(registry, tournamentSession, (clientId, message) => {
    registry
      .getAll()
      .find((client) => client.id === clientId)
      ?.send(message);
  })
);

const bootstrapClient = createClientBootstrap({
  listBots: () => botRegistry.list(),
  getAudioSettings: () => audioSettings.get(),
  getTournamentSession: () => tournamentSession.getSnapshot(),
  now: () => clock.now(),
});
const gateway = new WebSocketGateway(registry, dispatcher, bootstrapClient, () =>
  tournamentSession.onPresentAvailabilityChanged()
);

const httpServer = config.isDev
  ? await createDevServer(config.clientRoot)
  : createStaticServer(config.staticDir);
httpServer.on("upgrade", (request, socket, head) => {
  gateway.handleUpgrade(request, socket, head);
});

httpServer.listen(config.port, () => {
  const mode = config.isDev ? "dev (Vite middleware, HMR)" : "static (client/dist)";
  console.log(`Arena hub server listening on http://localhost:${config.port} [${mode}]`);
});
