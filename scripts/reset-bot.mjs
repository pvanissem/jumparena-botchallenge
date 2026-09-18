/**
 * Archiviert die aktive Bot-Arbeitsdatei, setzt sie auf die Standardvorlage
 * zurück und entfernt Session-Traces. Warnt vor anderen Git-Änderungen.
 * Nur explizit zwischen Besuchersessions ausfuehren; Tests nutzen Temp-Fixtures.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const activeBotPath = "client/src/bot/current-bot.js";

function warning(message) {
  console.warn(`\n${"!".repeat(72)}\n!!! WARNUNG !!!\n${message}\n${"!".repeat(72)}\n`);
}

async function checkGitStatus(root) {
  try {
    // Ohne Rename-Erkennung bleiben auch Umbenennungen auf die erlaubte Datei sichtbar.
    const { stdout } = await promisify(execFile)(
      "git",
      ["-C", root, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"],
      { timeout: 10000, maxBuffer: 4 * 1024 * 1024 }
    );
    const changes = stdout.split("\0").filter((entry) => entry && entry.slice(3) !== activeBotPath);
    if (changes.length) {
      warning(
        `Änderungen außerhalb von ${activeBotPath}:\n${changes
          .map((entry) => `  ${entry.slice(0, 2)} ${JSON.stringify(entry.slice(3))}`)
          .join(
            "\n"
          )}\n\nBitte mit git status / git diff prüfen und bei Bedarf selbst rückgängig machen.\nDer Reset setzt diese Änderungen nicht zurück.`
      );
    }
  } catch {
    warning(
      "Git-Status konnte nicht geprüft werden. Bitte das Repository manuell prüfen.\nDie Bot-Sicherung und der Reset werden trotzdem versucht."
    );
  }
}

function filenamePart(value, fallback) {
  return (
    value
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback
  );
}

function archiveStem(source) {
  // Nur Syntax lesen: Besuchercode darf im Betreiberprozess niemals ausgeführt werden.
  const file = ts.createSourceFile(
    "bot.js",
    source.toString("utf8"),
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS
  );
  const exported = file.statements.find(
    (node) => ts.isExportAssignment(node) && !node.isExportEquals
  );
  const metadata = {};
  if (
    !file.parseDiagnostics.length &&
    exported &&
    ts.isObjectLiteralExpression(exported.expression)
  ) {
    for (const property of exported.expression.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        ts.isStringLiteral(property.initializer) &&
        ["author", "name"].includes(property.name.text)
      ) {
        metadata[property.name.text] = property.initializer.text;
      }
    }
  }
  return `${filenamePart(metadata.author, "unbekannt")}-${filenamePart(metadata.name, "unbenannt")}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function archiveBot(root, source) {
  const directory = join(root, "bots");
  await mkdir(directory, { recursive: true });
  const stem = archiveStem(source);
  for (let suffix = 0; ; suffix++) {
    const path = join(directory, `${stem}${suffix ? `-${suffix}` : ""}.js`);
    try {
      await writeFile(path, source, { flag: "wx" });
      console.log(`Bot gesichert: ${path}`);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

export async function resetBot(root = join(here, "..")) {
  await checkGitStatus(root);
  const botDir = join(root, "client/src/bot");
  const traceDir = join(botDir, "runs");
  const template = await readFile(join(botDir, "current-bot.template.js"));
  let source;
  try {
    source = await readFile(join(root, activeBotPath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (source !== undefined) await archiveBot(root, source);
  await writeFile(join(root, activeBotPath), template);
  await rm(traceDir, { recursive: true, force: true });
  await mkdir(traceDir, { recursive: true });
}

if (process.argv[1] && pathToFileURL(await realpath(process.argv[1])).href === import.meta.url) {
  await resetBot();
  console.log("current-bot.js wurde zurückgesetzt; Bot-Traces wurden gelöscht.");
}
