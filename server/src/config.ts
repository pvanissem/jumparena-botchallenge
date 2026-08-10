import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  port: number;
  staticDir: string;
  /**
   * Dev-Modus (`NODE_ENV=development`, siehe `server/package.json`s `dev`-Script):
   * Statt der gebauten `client/dist` wird Vite im Middleware-Mode gegen
   * `clientRoot` gemountet, damit `npm run dev` einen einzigen Prozess/Origin
   * mit vollem HMR liefert (siehe `http/createDevServer.ts`).
   */
  isDev: boolean;
  clientRoot: string;
  /** Pfad zur JSON-Datei, in der die Bot-Registry persistiert wird (US-5). */
  botRegistryFile: string;
}

export function loadConfig(): ServerConfig {
  const port = Number(process.env.PORT ?? 3000);
  const staticDir = process.env.STATIC_DIR ?? join(currentDir, "../../client/dist");
  const isDev = process.env.NODE_ENV === "development";
  const clientRoot = join(currentDir, "../../client");
  const botRegistryFile = process.env.BOT_REGISTRY_FILE ?? join(currentDir, "../../data/bot-registry.json");

  return { port, staticDir, isDev, clientRoot, botRegistryFile };
}
