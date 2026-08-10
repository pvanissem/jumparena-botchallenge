import type { BotArtifact } from "@arena/shared";

/**
 * Persistence port for the BotRegistry. The concrete adapter can change
 * (JSON file today, something else tomorrow) without touching the registry.
 */
export interface BotRegistryStore {
  load(): BotArtifact[];
  save(bots: readonly BotArtifact[]): void;
}
