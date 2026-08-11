import type {
  MatchProgressMessage,
  MatchResultMessage,
  TournamentConfigureMessage,
  TournamentShowAction,
  TournamentShowState,
  TournamentState,
  TournamentStateMessage,
} from "@arena/shared";
import type { ConnectedClient } from "../ws/ConnectedClient";
import { selectNextPendingMatch } from "./selectNextPendingMatch";
import {
  addShowHold,
  canAdvance,
  enterTimedPhase,
  enterUntimedPhase,
  removeShowHold,
} from "./showPhaseMachine";
import { SHOW_PHASE_DURATIONS_MS } from "./showTiming";
import type { TournamentService } from "./TournamentService";

export interface Clock {
  now(): number;
}

export interface ShowScheduler {
  set(delayMs: number, callback: () => void): unknown;
  clear(handle: unknown): void;
}

export interface ReadyPresentClientSource {
  getReadyPresentClients(): ConnectedClient[];
}

export interface TournamentSessionSnapshot {
  state: TournamentState | null;
  show: TournamentShowState | null;
}

export interface TournamentSessionDependencies {
  tournament: TournamentService;
  readyPresentClients: ReadyPresentClientSource;
  clock: Clock;
  scheduler: ShowScheduler;
  createAttemptId: () => string;
  publishSnapshot: (message: TournamentStateMessage) => void;
}

export class TournamentSessionService {
  private show: TournamentShowState | null = null;
  private scheduleHandle: unknown = null;
  private scheduleGeneration = 0;

  constructor(private readonly dependencies: TournamentSessionDependencies) {}

  configure(message: TournamentConfigureMessage): boolean {
    if (this.show !== null || this.dependencies.tournament.getState() !== null) return false;
    if (!this.dependencies.tournament.configure(message)) return false;

    this.show = {
      phase: "ready",
      activeMatchId: null,
      activeRoundIndex: null,
      matchAttemptId: null,
      executorClientId: null,
      phaseEndsAtMs: null,
      heldRemainingMs: null,
      holds: [],
      presentReady: this.hasReadyPresentClient(),
    };
    this.publish();
    return true;
  }

  control(action: TournamentShowAction): boolean {
    if (!this.show) return false;

    if (action === "start") return this.start();
    if (action === "pause") return this.pause();
    if (action === "resume") return this.resume();
    if (action === "advance") return this.advance();
    return false;
  }

  acceptProgress(_senderId: string, message: MatchProgressMessage): boolean {
    return this.hasCurrentAttempt(_senderId, message.matchId, message.matchAttemptId);
  }

  acceptResult(senderId: string, message: MatchResultMessage): boolean {
    const show = this.show;
    if (!show || !this.hasCurrentAttempt(senderId, message.matchId, message.matchAttemptId)) {
      return false;
    }
    if (!this.dependencies.tournament.submitResult(message.matchId, message.result)) return false;

    this.cancelSchedule();
    this.show = {
      ...enterTimedPhase(
        show,
        "match-result",
        this.dependencies.clock.now(),
        SHOW_PHASE_DURATIONS_MS.matchResult
      ),
      matchAttemptId: null,
      executorClientId: null,
    };
    this.scheduleCurrentPhase();
    this.publish();
    return true;
  }

  onPresentAvailabilityChanged(): void {
    if (!this.show) return;
    const readyClients = this.dependencies.readyPresentClients.getReadyPresentClients();
    const presentReady = readyClients.length > 0;
    let next = this.show;

    if (this.show.phase === "match-running") {
      const executorStillReady = readyClients.some(
        (client) => client.id === this.show?.executorClientId
      );
      if (!executorStillReady) {
        const executor = readyClients[0] ?? null;
        next = {
          ...next,
          executorClientId: executor?.id ?? null,
          matchAttemptId: executor ? this.dependencies.createAttemptId() : null,
        };
      }
    } else if (canAdvance(this.show)) {
      if (presentReady) {
        next = removeShowHold(next, "present-unavailable", this.dependencies.clock.now());
      } else {
        next = addShowHold(next, "present-unavailable", this.dependencies.clock.now());
      }
    }

    if (next.presentReady !== presentReady) next = { ...next, presentReady };
    if (next === this.show) return;

    if (next.holds.length > 0) this.cancelSchedule();
    this.show = next;
    this.scheduleCurrentPhase();
    this.publish();
  }

  reset(): void {
    this.cancelSchedule();
    this.dependencies.tournament.reset();
    this.show = null;
    this.publish();
  }

  getSnapshot(): TournamentSessionSnapshot {
    return { state: this.dependencies.tournament.getState(), show: this.show };
  }

  private start(): boolean {
    if (this.show?.phase !== "ready") return false;
    const state = this.dependencies.tournament.getState();
    if (!state) return false;
    const selection = selectNextPendingMatch(state);
    if (!selection) return false;

    this.show = {
      ...enterTimedPhase(
        this.show,
        "matchup-intro",
        this.dependencies.clock.now(),
        SHOW_PHASE_DURATIONS_MS.matchupIntro
      ),
      activeMatchId: selection.match.id,
      activeRoundIndex: selection.roundIndex,
    };
    this.scheduleCurrentPhase();
    this.publish();
    return true;
  }

  private pause(): boolean {
    if (!this.show || !canAdvance(this.show)) return false;
    const held = addShowHold(this.show, "operator", this.dependencies.clock.now());
    if (held === this.show) return false;

    this.cancelSchedule();
    this.show = held;
    this.publish();
    return true;
  }

  private resume(): boolean {
    if (!this.show) return false;
    const resumed = removeShowHold(this.show, "operator", this.dependencies.clock.now());
    if (resumed === this.show) return false;

    this.show = resumed;
    this.scheduleCurrentPhase();
    this.publish();
    return true;
  }

  private advance(): boolean {
    if (!this.show || !canAdvance(this.show)) return false;
    return this.advanceTimedPhase();
  }

  private advanceTimedPhase(): boolean {
    if (!this.show) return false;
    this.cancelSchedule();

    if (this.show.phase === "matchup-intro") {
      this.show = enterTimedPhase(
        this.show,
        "countdown",
        this.dependencies.clock.now(),
        SHOW_PHASE_DURATIONS_MS.countdown
      );
    } else if (this.show.phase === "countdown") {
      const executor = this.dependencies.readyPresentClients.getReadyPresentClients()[0];
      if (!executor) {
        this.show = {
          ...addShowHold(this.show, "present-unavailable", this.dependencies.clock.now()),
          executorClientId: null,
          matchAttemptId: null,
          presentReady: false,
        };
        this.publish();
        return false;
      }
      if (
        !this.show.activeMatchId ||
        !this.dependencies.tournament.startMatch(this.show.activeMatchId)
      ) {
        return false;
      }
      this.show = {
        ...enterUntimedPhase(this.show, "match-running"),
        executorClientId: executor.id,
        matchAttemptId: this.dependencies.createAttemptId(),
        presentReady: true,
      };
    } else if (this.show.phase === "match-result") {
      this.show = enterTimedPhase(
        this.show,
        "bracket-update",
        this.dependencies.clock.now(),
        SHOW_PHASE_DURATIONS_MS.bracketUpdate
      );
    } else if (this.show.phase === "bracket-update") {
      this.show = this.nextMatchOrChampion(this.show);
      if (!this.show) return false;
    } else {
      return false;
    }

    this.scheduleCurrentPhase();
    this.publish();
    return true;
  }

  private nextMatchOrChampion(show: TournamentShowState): TournamentShowState | null {
    const state = this.dependencies.tournament.getState();
    if (!state) return null;
    if (state.status === "finished") {
      return enterUntimedPhase(show, "champion");
    }

    const selection = selectNextPendingMatch(state);
    if (!selection) return null;
    return {
      ...enterTimedPhase(
        show,
        "matchup-intro",
        this.dependencies.clock.now(),
        SHOW_PHASE_DURATIONS_MS.matchupIntro
      ),
      activeMatchId: selection.match.id,
      activeRoundIndex: selection.roundIndex,
      matchAttemptId: null,
      executorClientId: null,
    };
  }

  private scheduleCurrentPhase(): void {
    if (!this.show || this.show.phaseEndsAtMs === null || this.show.holds.length > 0) return;
    if (!canAdvance(this.show)) return;

    if (this.scheduleHandle !== null) this.dependencies.scheduler.clear(this.scheduleHandle);
    const generation = ++this.scheduleGeneration;
    const phase = this.show.phase;
    const matchId = this.show.activeMatchId;
    const deadline = this.show.phaseEndsAtMs;
    const delayMs = Math.max(0, deadline - this.dependencies.clock.now());

    this.scheduleHandle = this.dependencies.scheduler.set(delayMs, () => {
      if (
        generation !== this.scheduleGeneration ||
        this.show?.phase !== phase ||
        this.show.activeMatchId !== matchId ||
        this.show.phaseEndsAtMs !== deadline
      ) {
        return;
      }
      this.scheduleHandle = null;
      this.advanceTimedPhase();
    });
  }

  private cancelSchedule(): void {
    this.scheduleGeneration += 1;
    if (this.scheduleHandle !== null) {
      this.dependencies.scheduler.clear(this.scheduleHandle);
      this.scheduleHandle = null;
    }
  }

  private hasReadyPresentClient(): boolean {
    return this.dependencies.readyPresentClients.getReadyPresentClients().length > 0;
  }

  private hasCurrentAttempt(
    senderId: string,
    matchId: string,
    matchAttemptId: string | undefined
  ): boolean {
    return (
      this.show?.phase === "match-running" &&
      this.show.activeMatchId === matchId &&
      this.show.executorClientId === senderId &&
      this.show.matchAttemptId !== null &&
      this.show.matchAttemptId === matchAttemptId
    );
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    this.dependencies.publishSnapshot({
      type: "tournament-state",
      ...snapshot,
      serverNowMs: this.dependencies.clock.now(),
    });
  }
}
