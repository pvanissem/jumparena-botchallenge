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
 * `decodeURIComponent`, das bei fehlerhaft kodierten Pfaden (`URIError`)
 * `null` statt eine Exception liefert – der Aufrufer behandelt `null` dann
 * wie einen unbekannten Pfad (SPA-Fallback), analog zu `parseInboundMessage`
 * in `@arena/shared` (Fail-Safe statt Crash bei fremdgesteuertem Input).
 */
function safeDecodeUriPath(rawPath: string): string | null {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
}

/**
 * Serves the built client (Vite `dist` output) and falls back to
 * `index.html` for any unknown path, so that React Router can handle
 * client-side routes like /dev, /present, /admin on direct load/reload
 * (see design.md "Fehlerbehandlung" -> SPA-Fallback).
 */
export function createStaticServer(staticDir: string): Server {
  return createServer((req, res) => {
    const rawPath = (req.url ?? "/").split("?")[0];
    // URLs kommen prozent-kodiert an (z.B. Leerzeichen -> %20, siehe Dateinamen
    // wie "Terrain (16x16).png"). Ohne Dekodierung findet `existsSync` die
    // Datei nie und der SPA-Fallback greift fälschlich auch für echte,
    // existierende Assets (führte zu "Terrain hat keine Textur" im Client).
    // `decodeURIComponent` wirft bei fehlerhaft kodierten URLs (z.B. ein
    // einzelnes "%" ohne gültige Hex-Folge) – in diesem Fall wird wie bei
    // einem unbekannten Pfad auf `index.html` zurückgefallen, statt den
    // Serverprozess mit einer unbehandelten Exception abstürzen zu lassen.
    const requestedPath = safeDecodeUriPath(rawPath);
    const candidatePath =
      requestedPath === null || requestedPath === "/"
        ? join(staticDir, "index.html")
        : join(staticDir, requestedPath);

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
