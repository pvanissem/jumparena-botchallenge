/**
 * Modul-Contract eines Bot-Artefakts – siehe
 * `docs/09-bot-artefakt-und-turnier.md`.
 */

import type { ToolsApi } from "./navigation";
import type { BotState, DecideResult } from "./state";

export const SUPPORTED_API_VERSION = 1 as const;
export const SUPPORTED_FRAMEWORK_VERSION = 1 as const;

interface BotMetadata {
  apiVersion: typeof SUPPORTED_API_VERSION;
  name?: string;
  author?: string;
  color?: string;
}

export type BotModule = BotMetadata &
  (
    | { frameworkVersion?: undefined; decide: (state: BotState) => DecideResult }
    | {
        frameworkVersion: typeof SUPPORTED_FRAMEWORK_VERSION;
        decide: (state: BotState, tools: ToolsApi) => DecideResult;
      }
  );

export type BotModuleValidation =
  | { valid: true; module: BotModule }
  | { valid: false; reason: string };

/**
 * Kette kleiner, benannter Prüfungen (Fail-Fast, jede Regel isoliert testbar).
 * Neue Regeln (z.B. eine weitere unterstützte apiVersion) werden additiv
 * ergänzt, ohne bestehende Prüfungen zu ändern (Open/Closed).
 */
type Check = (candidate: Record<string, unknown>) => string | null;

const hasSupportedApiVersion: Check = (candidate) =>
  candidate.apiVersion === SUPPORTED_API_VERSION
    ? null
    : `apiVersion ${String(candidate.apiVersion)} nicht unterstützt`;

const hasDecideFunction: Check = (candidate) =>
  typeof candidate.decide === "function" ? null : "decide ist keine Funktion";

const hasSupportedFrameworkVersion: Check = (candidate) =>
  candidate.frameworkVersion === undefined ||
  candidate.frameworkVersion === SUPPORTED_FRAMEWORK_VERSION
    ? null
    : `frameworkVersion ${String(candidate.frameworkVersion)} nicht unterstützt`;

const checks: readonly Check[] = [
  hasSupportedApiVersion,
  hasSupportedFrameworkVersion,
  hasDecideFunction,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateBotModule(candidate: unknown): BotModuleValidation {
  if (!isRecord(candidate)) {
    return { valid: false, reason: "kein Objekt" };
  }

  for (const check of checks) {
    const reason = check(candidate);
    if (reason !== null) {
      return { valid: false, reason };
    }
  }

  return { valid: true, module: candidate as unknown as BotModule };
}
