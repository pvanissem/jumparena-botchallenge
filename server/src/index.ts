import { loadConfig } from "./config";
import { createDevServer } from "./http/createDevServer";
import { createStaticServer } from "./http/createStaticServer";
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

const gateway = new WebSocketGateway(registry, dispatcher);

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
