import type {
  BotArtifact,
  MatchParticipant,
  MatchResult,
  TournamentConfigureMessage,
  TournamentMode,
  TournamentState,
} from "@arena/shared";
import {
  ALLOWED_GROUP_SIZES,
  DEFAULT_GROUP_SIZE,
  DEFAULT_LIVES_PER_RUN,
  isValidGroupSize,
  isValidLevelId,
  isValidLivesPerRun,
  MAX_LIVES_PER_RUN,
  MIN_LIVES_PER_RUN,
} from "@arena/shared";
import type { BotRegistry } from "../botRegistry/BotRegistry";
import type { TournamentStrategy } from "./TournamentStrategy";

/**
 * Hält den aktuellen Turnierzustand und delegiert Bracket-Erzeugung/-Fortschreiben
 * an eine austauschbare {@link TournamentStrategy}. Single Source of Truth für
 * alle Turnier-Operationen.
 */
export class TournamentService {
  private state: TournamentState | null = null;
  private readonly strategies: Record<TournamentMode, TournamentStrategy>;

  constructor(
    private readonly botRegistry: BotRegistry,
    ...strategies: TournamentStrategy[]
  ) {
    this.strategies = Object.fromEntries(strategies.map((s) => [s.mode, s])) as Record<
      TournamentMode,
      TournamentStrategy
    >;
  }

  getState(): TournamentState | null {
    return this.state;
  }

  configure(message: TournamentConfigureMessage): TournamentState | null {
    const participants = this.resolveParticipants(message.botIds);
    if (participants.length < 2) {
      console.warn("Turnier-Konfiguration abgelehnt: weniger als 2 Teilnehmer");
      return null;
    }

    // Fehlender Wert = Default (Rückwärtskompatibilität), vorhandener Wert muss
    // gültig sein – sonst Ablehnung wie bei zu wenigen Teilnehmern.
    const livesPerRun = message.livesPerRun ?? DEFAULT_LIVES_PER_RUN;
    if (!isValidLivesPerRun(livesPerRun)) {
      console.warn(
        `Turnier-Konfiguration abgelehnt: ungültige Leben pro Lauf (${String(message.livesPerRun)}), erlaubt ${MIN_LIVES_PER_RUN}-${MAX_LIVES_PER_RUN}`
      );
      return null;
    }

    const groupSize = message.groupSize ?? DEFAULT_GROUP_SIZE;
    if (!isValidGroupSize(groupSize)) {
      console.warn(
        `Turnier-Konfiguration abgelehnt: ungültige Gruppengröße (${String(message.groupSize)}), erlaubt ${ALLOWED_GROUP_SIZES.join(" oder ")}`
      );
      return null;
    }

    const stageLevelIds = message.stageLevelIds;
    if (stageLevelIds.length === 0) {
      console.warn("Turnier-Konfiguration abgelehnt: stageLevelIds darf nicht leer sein");
      return null;
    }
    const unknownLevelIds = stageLevelIds.filter((id) => !isValidLevelId(id));
    if (unknownLevelIds.length > 0) {
      console.warn(
        `Turnier-Konfiguration abgelehnt: unbekannte Level-IDs (${unknownLevelIds.join(", ")})`
      );
      return null;
    }

    const strategy = this.strategies[message.mode];
    const rounds = strategy.createRounds(participants, { groupSize });

    this.state = {
      mode: message.mode,
      stageLevelIds,
      livesPerRun,
      groupSize,
      rounds,
      status: "idle",
      championBotId: null,
    };

    return this.state;
  }

  startMatch(matchId: string): boolean {
    if (!this.state) return false;

    const match = this.state.rounds.flat().find((m) => m.id === matchId);
    if (match?.status !== "pending") return false;

    match.status = "running";
    this.state.status = "running";
    return true;
  }

  submitResult(matchId: string, result: MatchResult): boolean {
    if (!this.state) return false;

    const match = this.state.rounds.flat().find((m) => m.id === matchId);
    if (match?.status !== "running") return false;

    const strategy = this.strategies[this.state.mode];
    this.state = strategy.advance(this.state, result);
    return true;
  }

  reset(): void {
    this.state = null;
  }

  private resolveParticipants(botIds: string[]): MatchParticipant[] {
    const byId = new Map(this.botRegistry.list().map((b) => [b.id, b]));
    const participants: MatchParticipant[] = [];

    for (const id of botIds) {
      const bot = byId.get(id);
      if (!bot) continue;
      participants.push(this.toParticipant(bot));
      byId.delete(id);
    }

    return participants;
  }

  private toParticipant(bot: BotArtifact): MatchParticipant {
    return {
      botId: bot.id,
      name: bot.name,
      author: bot.author,
      color: bot.color,
    };
  }
}
