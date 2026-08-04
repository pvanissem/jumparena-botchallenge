import { readFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import { join } from "node:path";
import { createServer as createViteServer } from "vite";

/**
 * Dev-Pendant zu `createStaticServer`: Statt der gebauten `client/dist`
 * mountet dieser Server Vite im Middleware-Mode (siehe
 * https://vite.dev/guide/ssr.html#setting-up-the-dev-server) gegen
 * `clientRoot` (das `client`-Package), sodass `npm run dev` einen einzigen
 * Prozess auf einem einzigen Origin/Port liefert - inklusive vollem
 * Vite-HMR - statt zwei separate Prozesse (Hub-Server + eigener
 * Vite-Dev-Server) auf unterschiedlichen Ports zu benötigen. Der WS-Gateway
 * (siehe `index.ts`) wird unverändert per `httpServer.on("upgrade", ...)`
 * an denselben Server gehängt.
 *
 * `appType: "custom"` deaktiviert Vites eingebautes HTML-Serving, damit wir
 * den SPA-Fallback (jede unbekannte Route -> transformiertes `index.html`,
 * für React-Router-Routen wie /dev, /present, /admin) selbst übernehmen -
 * analog zum Fallback in `createStaticServer`.
 *
 * Bewusst nicht unit-getestet (echter Vite-Dev-Server/Filesystem-Root
 * nötig) - manuell verifiziert über `npm run dev` (siehe README/AGENTS.md
 * Test-Strategie-Konvention für reine Wiring-/Infrastruktur-Module).
 */
export async function createDevServer(clientRoot: string): Promise<Server> {
  const vite = await createViteServer({
    root: clientRoot,
    configFile: join(clientRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
  });

  const httpServer = createHttpServer((req, res) => {
    vite.middlewares(req, res, async () => {
      try {
        const url = req.url ?? "/";
        const rawTemplate = await readFile(join(clientRoot, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(url, rawTemplate);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end((error as Error).stack ?? String(error));
      }
    });
  });

  return httpServer;
}
