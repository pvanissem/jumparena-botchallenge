/**
 * Regressionsschutz: das ausgelieferte Standard-Bot-Template muss den
 * statischen Guard bestehen. Der Guard (`checkStaticGuard`, siehe
 * `@arena/bot-contract`) prüft naiv per Regex über den GESAMTEN Quelltext -
 * auch über Kommentare hinweg. Ein Dokumentationstext, der z.B. das Wort
 * "import" erwähnt, würde den eigenen Default-Bot sonst sofort blockieren
 * (siehe `.features/dev-station-mode/` - real aufgetretener Bug).
 */
import { checkStaticGuard } from "@arena/bot-contract";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const templateSource = readFileSync(join(here, "current-bot.template.js"), "utf-8");

describe("current-bot.template.js", () => {
  it("passes the static guard (no forbidden keyword, not even in comments)", () => {
    const result = checkStaticGuard(templateSource);
    expect(result.allowed).toBe(true);
  });
});
