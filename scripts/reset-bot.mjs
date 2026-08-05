/**
 * Setzt die aktive Bot-Arbeitsdatei auf die Standardvorlage zurück (bzw.
 * legt sie erstmalig an) - siehe .features/dev-station-mode/design.md,
 * Abschnitt 1. Triviales Dateisystem-Skript, bewusst ohne Unit-Test
 * (manuelle Verifikation siehe design.md/tasks.md Task 0.4).
 */
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const botDir = join(here, "../client/src/bot");
const templatePath = join(botDir, "current-bot.template.js");
const targetPath = join(botDir, "current-bot.js");

copyFileSync(templatePath, targetPath);
console.log("current-bot.js wurde aus current-bot.template.js zurückgesetzt.");
