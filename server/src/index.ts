import { BotRegistry } from "./botRegistry/BotRegistry";
import { createBotAddHandler } from "./botRegistry/handlers/createBotAddHandler";
import { createBotRemoveHandler } from "./botRegistry/handlers/createBotRemoveHandler";
import { JsonFileBotRegistryStore } from "./botRegistry/JsonFileBotRegistryStore";
import { loadConfig } from "./config";
import { createDevServer } from "./http/createDevServer";
import { createStaticServer } from "./http/createStaticServer";
import { createTournamentStateBroadcaster } from "./tournament/broadcastTournamentState";
import { createMatchResultHandler } from "./tournament/handlers/createMatchResultHandler";
import { createMatchStartHandler } from "./tournament/handlers/createMatchStartHandler";
import { createTournamentConfigureHandler } from "./tournament/handlers/createTournamentConfigureHandler";
import { createTournamentResetHandler } from "./tournament/handlers/createTournamentResetHandler";
import { SingleEliminationStrategy } from "./tournament/SingleEliminationStrategy";
import { TournamentService } from "./tournament/TournamentService";
import { BroadcastRouter } from "./ws/BroadcastRouter";
import { ClientRegistry } from "./ws/ClientRegistry";
import { createBroadcastRelayHandler } from "./ws/handlers/createBroadcastRelayHandler";
import { MessageDispatcher } from "./ws/MessageDispatcher";
import { WebSocketGateway } from "./ws/WebSocketGateway";

const config = loadConfig();

const registry = new ClientRegistry();
const broadcastRouter = new BroadcastRouter(registry);
const dispatcher = new MessageDispatcher();
dispatcher.register("ping-broadcast", createBroadcastRelayHandler(broadcastRouter));
dispatcher.register("audio-settings", createBroadcastRelayHandler(broadcastRouter));

const botRegistryStore = new JsonFileBotRegistryStore(config.botRegistryFile);
const botRegistry = new BotRegistry(botRegistryStore.load());
dispatcher.register(
  "bot-add",
  createBotAddHandler(botRegistry, botRegistryStore, (message) =>
    broadcastRouter.routeToAll(message)
  )
);
dispatcher.register(
  "bot-remove",
  createBotRemoveHandler(botRegistry, botRegistryStore, (message) =>
    broadcastRouter.routeToAll(message)
  )
);

const tournamentService = new TournamentService(botRegistry, new SingleEliminationStrategy());
const broadcastTournamentStateToAll = createTournamentStateBroadcaster(
  tournamentService,
  (message) => broadcastRouter.routeToAll(message)
);

dispatcher.register(
  "tournament-configure",
  createTournamentConfigureHandler(tournamentService, broadcastTournamentStateToAll)
);
dispatcher.register(
  "match-start",
  createMatchStartHandler(tournamentService, broadcastTournamentStateToAll)
);
dispatcher.register(
  "tournament-reset",
  createTournamentResetHandler(tournamentService, broadcastTournamentStateToAll)
);
dispatcher.register(
  "match-result",
  createMatchResultHandler(tournamentService, broadcastTournamentStateToAll)
);
dispatcher.register("match-progress", createBroadcastRelayHandler(broadcastRouter));

const gateway = new WebSocketGateway(registry, dispatcher, (client) => {
  client.send({ type: "bot-registry-snapshot", bots: botRegistry.list() });
  client.send({ type: "tournament-state", state: tournamentService.getState() });
});

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
