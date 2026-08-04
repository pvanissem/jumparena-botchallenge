/**
 * Statischer Vorfilter gegen offensichtlich unerlaubte Konstrukte in
 * Bot-Quellcode – siehe `docs/02-bot-api.md` und `docs/09-bot-artefakt-und-turnier.md`.
 *
 * Ersetzt NICHT die Isolation durch den Web Worker (siehe
 * `client/src/sandbox/BotRunner.ts`), sondern ist ein zusätzlicher, schneller
 * erster Verteidigungsring vor der eigentlichen Ausführung.
 */

export interface StaticGuardResult {
  allowed: boolean;
  matchedPattern?: string;
}

interface ForbiddenPattern {
  label: string;
  pattern: RegExp;
}

/**
 * Neue verbotene Muster = neuer Listen-Eintrag (Open/Closed, keine
 * Funktionsänderung nötig).
 */
const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  { label: "import", pattern: /\bimport\b/ },
  { label: "require(", pattern: /\brequire\s*\(/ },
  { label: "fetch(", pattern: /\bfetch\s*\(/ },
  { label: "window.", pattern: /\bwindow\./ },
  { label: "document.", pattern: /\bdocument\./ },
  { label: "eval(", pattern: /\beval\s*\(/ },
  { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
];

export function checkStaticGuard(sourceCode: string): StaticGuardResult {
  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(sourceCode)) {
      return { allowed: false, matchedPattern: label };
    }
  }
  return { allowed: true };
}
