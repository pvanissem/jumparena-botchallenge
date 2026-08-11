import type { MatchDef, MatchResult, MatchResultEntry } from "@arena/shared";

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasValidValues(entry: MatchResultEntry): boolean {
  return (
    typeof entry.score === "number" &&
    Number.isFinite(entry.score) &&
    isNonNegativeInteger(entry.rank) &&
    entry.rank >= 1 &&
    isNonNegativeInteger(entry.fruitScore) &&
    isNonNegativeInteger(entry.coinsCollected) &&
    isNonNegativeInteger(entry.deaths) &&
    isNonNegativeInteger(entry.timeElapsedMs) &&
    typeof entry.reachedGoal === "boolean" &&
    typeof entry.disabled === "boolean"
  );
}

export function validateMatchResult(match: MatchDef, result: MatchResult): boolean {
  if (!Array.isArray(result.entries) || result.entries.length !== match.participants.length) {
    return false;
  }

  const participantIds = new Set(match.participants.map((participant) => participant.botId));
  const resultIds = new Set(result.entries.map((entry) => entry.botId));
  const ranks = new Set(result.entries.map((entry) => entry.rank));

  if (resultIds.size !== participantIds.size || ranks.size !== result.entries.length) return false;
  if (!result.entries.every(hasValidValues)) return false;
  if (!result.entries.every((entry) => participantIds.has(entry.botId))) return false;

  return Array.from({ length: result.entries.length }, (_, index) => index + 1).every((rank) =>
    ranks.has(rank)
  );
}
