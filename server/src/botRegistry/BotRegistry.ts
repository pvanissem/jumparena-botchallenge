import type { BotArtifact } from "@arena/shared";

/**
 * In-memory store for collected bot artifacts. Single responsibility: keep
 * track of registered bots and answer queries. Knows nothing about WebSockets,
 * persistence or validation (SRP).
 */
export class BotRegistry {
  private readonly bots = new Map<string, BotArtifact>();

  constructor(initial: readonly BotArtifact[] = []) {
    for (const bot of initial) this.bots.set(bot.id, bot);
  }

  add(bot: BotArtifact): void {
    this.bots.set(bot.id, bot);
  }

  /** `false` bei unbekannter ID – erlaubt dem Aufrufer, den Broadcast zu
   *  unterlassen (US-4: no-op statt Fehler). */
  remove(id: string): boolean {
    return this.bots.delete(id);
  }

  list(): BotArtifact[] {
    return [...this.bots.values()];
  }
}
