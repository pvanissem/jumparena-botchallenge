import { loadConfig } from "./config";
import { createStaticServer } from "./http/createStaticServer";
import { BroadcastRouter } from "./ws/BroadcastRouter";
import { ClientRegistry } from "./ws/ClientRegistry";
import { createPingBroadcastHandler } from "./ws/handlers/handlePingBroadcast";
import { MessageDispatcher } from "./ws/MessageDispatcher";
import { WebSocketGateway } from "./ws/WebSocketGateway";

const config = loadConfig();

const registry = new ClientRegistry();
const broadcastRouter = new BroadcastRouter(registry);
const dispatcher = new MessageDispatcher();
dispatcher.register("ping-broadcast", createPingBroadcastHandler(broadcastRouter));

const gateway = new WebSocketGateway(registry, dispatcher);

const httpServer = createStaticServer(config.staticDir);
httpServer.on("upgrade", (request, socket, head) => {
  gateway.handleUpgrade(request, socket, head);
});

httpServer.listen(config.port, () => {
  console.log(`Arena hub server listening on http://localhost:${config.port}`);
});
