import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { MAX_BOT_TRACE_BYTES } from "../src/game/trace/boundBotTrace";
import { validateTraceSample } from "../src/game/trace/validateTraceSample";

interface TraceEnvelope {
  schemaVersion: number;
  run: {
    startedAt: string;
    sessionId: string;
    botRevision: string;
    status: "running" | "completed";
    result: string | null;
  };
  summary: unknown;
  events: unknown[];
  findings: unknown[];
  windows: unknown[];
}

function validateTrace(value: unknown): asserts value is TraceEnvelope {
  const trace = value as Partial<TraceEnvelope> | null;
  if (
    (trace?.schemaVersion !== 1 && trace?.schemaVersion !== 2) ||
    typeof trace.run?.startedAt !== "string" ||
    typeof trace.run.sessionId !== "string" ||
    trace.run.sessionId.length === 0 ||
    typeof trace.run.botRevision !== "string" ||
    trace.run.botRevision.length === 0 ||
    (trace.run.status !== "running" && trace.run.status !== "completed") ||
    (trace.run.status === "running" && trace.run.result !== null) ||
    (trace.run.status === "completed" && typeof trace.run.result !== "string") ||
    trace.summary === undefined ||
    !Array.isArray(trace.events) ||
    !Array.isArray(trace.findings) ||
    !Array.isArray(trace.windows)
  ) {
    throw new Error("Trace hat eine ungültige Struktur");
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BOT_TRACE_BYTES) {
    throw new Error("Trace exceeds 2 MiB");
  }
  if (trace.schemaVersion === 2) {
    if (trace.windows.length > 8) throw new Error("Trace exceeds eight windows");
    for (const value of trace.windows) {
      const window = value as {
        fromTick?: number;
        toTick?: number;
        reason?: string;
        samples?: unknown[];
      } | null;
      if (
        !window ||
        typeof window.fromTick !== "number" ||
        typeof window.toTick !== "number" ||
        !Number.isSafeInteger(window.fromTick) ||
        !Number.isSafeInteger(window.toTick) ||
        window.fromTick > window.toTick ||
        typeof window.reason !== "string" ||
        !Array.isArray(window.samples)
      ) {
        throw new Error("Trace window invalid");
      }
      for (const value of window.samples) {
        if (!validateTraceSample(value, window.fromTick, window.toTick)) {
          throw new Error("Trace sample or navigation diagnostic invalid");
        }
      }
    }
  }
}

function timestampFilename(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) throw new Error("Trace enthält keinen gültigen Startzeitpunkt");
  return `${date.toISOString().replace(/:/g, "-").replace(".", "-")}.json`;
}

const pendingWrites = new Map<string, Promise<void>>();

export async function persistBotTrace(value: unknown, directory: string): Promise<string> {
  validateTrace(value);
  await mkdir(directory, { recursive: true });
  const filename = timestampFilename(value.run.startedAt);
  const target = `${directory}/${filename}`;
  const body = JSON.stringify(value);

  const previous = pendingWrites.get(target) ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(async () => {
      try {
        const existing = JSON.parse(await readFile(target, "utf8")) as Partial<TraceEnvelope>;
        if (existing.run?.status === "completed") return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      const temporary = `${target}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
      try {
        await writeFile(temporary, body, { flag: "wx" });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true });
      }
    });
  pendingWrites.set(target, operation);
  try {
    await operation;
  } finally {
    if (pendingWrites.get(target) === operation) pendingWrites.delete(target);
  }
  return filename;
}

export const BOT_TRACE_DIRECTORY = fileURLToPath(new URL("../src/bot/runs", import.meta.url));

export function botTracePlugin(directory = BOT_TRACE_DIRECTORY): Plugin {
  return {
    name: "bot-run-traces",
    configureServer(server) {
      server.middlewares.use("/__bot-traces/runs", (request, response, next) => {
        if (request.method !== "POST") return next();
        let body = "";
        let bytes = 0;
        let oversized = false;
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
          if (oversized) return;
          bytes += Buffer.byteLength(chunk, "utf8");
          if (bytes > MAX_BOT_TRACE_BYTES) {
            oversized = true;
            body = "";
            response.statusCode = 413;
            response.end("Trace exceeds 2 MiB");
            return;
          }
          body += chunk;
        });
        request.on("end", () => {
          if (oversized) return;
          void (async () => {
            try {
              const trace = JSON.parse(body) as unknown;
              await persistBotTrace(trace, directory);
              response.statusCode = 201;
              response.end();
            } catch (error) {
              response.statusCode =
                error instanceof SyntaxError || String(error).includes("Trace") ? 400 : 500;
              response.end(String(error));
            }
          })();
        });
      });
    },
  };
}
