import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/**
 * Serves the built client (Vite `dist` output) and falls back to
 * `index.html` for any unknown path, so that React Router can handle
 * client-side routes like /dev, /present, /admin on direct load/reload
 * (see design.md "Fehlerbehandlung" -> SPA-Fallback).
 */
export function createStaticServer(staticDir: string): Server {
  return createServer((req, res) => {
    const requestedPath = (req.url ?? "/").split("?")[0];
    const candidatePath = join(staticDir, requestedPath === "/" ? "index.html" : requestedPath);

    const filePath =
      existsSync(candidatePath) && candidatePath.startsWith(staticDir)
        ? candidatePath
        : join(staticDir, "index.html");

    try {
      const body = readFileSync(filePath);
      const contentType = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}
