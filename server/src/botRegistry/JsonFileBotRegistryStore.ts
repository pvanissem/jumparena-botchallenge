import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BotArtifact } from "@arena/shared";
import type { BotRegistryStore } from "./BotRegistryStore";

/**
 * Simple JSON-file persistence for the bot registry. Synchronous, full
 * rewrite on every save - perfectly fine because the data set is tiny
 * (a few dozen small bot sources) and it avoids async write-queue races.
 */
export class JsonFileBotRegistryStore implements BotRegistryStore {
  constructor(private readonly filePath: string) {}

  load(): BotArtifact[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const content = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("persisted registry is not an array");
      }
      return parsed as BotArtifact[];
    } catch (err) {
      console.warn(
        `Bot-Registry-Datei ${this.filePath} konnte nicht geladen werden; starte mit leerer Registry:`,
        err
      );
      return [];
    }
  }

  save(bots: readonly BotArtifact[]): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(bots, null, 2));
    } catch (err) {
      console.warn(`Bot-Registry-Datei ${this.filePath} konnte nicht gespeichert werden:`, err);
    }
  }
}
