/**
 * Setzt die aktive Bot-Arbeitsdatei auf die Standardvorlage zurück (bzw.
 * legt sie erstmalig an) und entfernt Session-Traces.
 * Nur explizit zwischen Besuchersessions ausfuehren; Tests nutzen Temp-Fixtures.
 */
import { copyFile, mkdir, realpath, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export async function resetBot(root = join(here, "..")) {
  const botDir = join(root, "client/src/bot");
  const traceDir = join(botDir, "runs");
  await copyFile(join(botDir, "current-bot.template.js"), join(botDir, "current-bot.js"));
  await rm(traceDir, { recursive: true, force: true });
  await mkdir(traceDir, { recursive: true });
}

if (process.argv[1] && pathToFileURL(await realpath(process.argv[1])).href === import.meta.url) {
  await resetBot();
  console.log("current-bot.js wurde zurückgesetzt; Bot-Traces wurden gelöscht.");
}
