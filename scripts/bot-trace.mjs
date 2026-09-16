/** Read-only CLI; start through npm run -s bot:trace (Node 22.14+). */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { botRevisionForSource } from "../client/src/game/trace/botTraceIdentity.ts";
import {
  focusTrace,
  serializeReport,
  summarizeTrace,
} from "../client/src/game/trace/readBotTrace.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultBot = join(root, "client/src/bot/current-bot.js");

export async function readTrace(file) {
  const trace = JSON.parse(await readFile(file, "utf8"));
  if (
    ![1, 2].includes(trace?.schemaVersion) ||
    typeof trace.run?.botRevision !== "string" ||
    !trace.summary ||
    !Array.isArray(trace.events) ||
    !Array.isArray(trace.findings) ||
    !Array.isArray(trace.windows) ||
    !trace.windows.every((w) => Array.isArray(w.samples))
  ) {
    throw new Error("Keine unterstützte Trace-Datei");
  }
  return trace;
}

export async function runTraceCommand(
  args,
  { botFile = defaultBot, runsDir = join(dirname(botFile), "runs") } = {}
) {
  const [command = "summary", file, tickText] = args;
  if (command === "help" || command === "--help")
    return {
      usage: [
        "npm run -s bot:trace -- [summary]",
        "npm run -s bot:trace -- list",
        "npm run -s bot:trace -- summary <Datei>",
        "npm run -s bot:trace -- focus <Datei> <Tick>",
      ],
      note: "Datei: Name unter runs/ oder Pfad. Standard: neuester Versuch zur aktuellen Bot-Revision. Focus zeigt ±15 Ticks, höchstens 7 Samples. Keine Aussage über einen ganzen Lauf.",
    };
  if (
    !["list", "summary", "focus"].includes(command) ||
    args.length > (command === "focus" ? 3 : command === "list" ? 1 : 2) ||
    (command === "focus" &&
      (!file ||
        tickText === undefined ||
        !/^\d+$/.test(tickText) ||
        !Number.isSafeInteger(Number(tickText))))
  ) {
    throw new Error("Ungültiger Aufruf; bot:trace -- help zeigt die Befehle");
  }
  const revision = botRevisionForSource(await readFile(botFile, "utf8"));
  if (file) {
    const path = file === basename(file) ? join(runsDir, file) : resolve(file);
    const trace = await readTrace(path);
    return {
      file: path,
      ...(command === "focus"
        ? focusTrace(trace, Number(tickText), revision)
        : summarizeTrace(trace, revision)),
    };
  }
  let names;
  try {
    names = await readdir(runsDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    names = [];
  }
  const files = [];
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const path = join(runsDir, name);
    try {
      files.push({ path, modified: (await stat(path)).mtimeMs });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  files.sort((a, b) => b.modified - a.modified || b.path.localeCompare(a.path));
  let unreadable = 0;
  const attempts = [];
  for (const { path } of files) {
    let trace;
    try {
      trace = await readTrace(path);
    } catch {
      unreadable++;
      continue;
    }
    const currentCode = trace.run.botRevision === revision;
    if (command === "summary" && currentCode)
      return { file: path, unreadableFiles: unreadable, ...summarizeTrace(trace, revision) };
    if (command === "list") {
      attempts.push({
        file: path,
        currentCode,
        sessionId: trace.run.sessionId,
        revision: trace.run.botRevision,
        level: trace.run.levelId,
        result: trace.run.result,
        status: trace.run.status,
        durationMs: trace.run.durationMs,
        deathCause: trace.summary.deathCause,
        fruitScore: trace.summary.fruitScore,
        truncated: !!trace.truncation,
      });
      if (attempts.length === 5) break;
    }
  }
  return command === "list"
    ? {
        expectedRevision: revision,
        attempts,
        unreadableFiles: unreadable,
        note: "Höchstens fünf gespeicherte Versuche, keine vollständige Session-Auswertung.",
      }
    : {
        expectedRevision: revision,
        unreadableFiles: unreadable,
        message:
          "Kein Trace zur aktuellen Bot-Revision vorhanden. Bot laufen lassen; list zeigt ältere Versuche.",
      };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${serializeReport(await runTraceCommand(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: String(error.message).slice(0, 300) })}\n`);
    process.exitCode = 1;
  }
}
