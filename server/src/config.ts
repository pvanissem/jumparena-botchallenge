import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  port: number;
  staticDir: string;
}

export function loadConfig(): ServerConfig {
  const port = Number(process.env.PORT ?? 3000);
  const staticDir = process.env.STATIC_DIR ?? join(currentDir, "../../client/dist");

  return { port, staticDir };
}
