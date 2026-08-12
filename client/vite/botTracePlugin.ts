import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

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
    trace?.schemaVersion !== 1 ||
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
  const body = `${JSON.stringify(value, null, 2)}\n`;

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
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
          body += chunk;
        });
        request.on("end", () => {
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
