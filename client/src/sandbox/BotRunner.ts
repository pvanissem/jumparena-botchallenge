/**
 * Sichere, timeout- und fehlertolerante Ausführung einer `decide(state)`-
 * Implementierung über einen Web Worker – siehe
 * `.features/bot-decide-api/design.md` für die vollständige Herleitung.
 */
import { ACTIONS, type Action, type BotState, checkStaticGuard } from "@arena/bot-contract";
import type { WorkerLike, WorkerToHostMessage } from "./workerLike";

export interface BotRunnerOptions {
  /** Zeitlimit pro Tick in ms, Default 5 (siehe docs/02-bot-api.md). */
  timeoutMs?: number;
  /** Schwelle aufeinanderfolgender Fehlversuche, Default 10 (siehe docs/09). */
  maxConsecutiveFailures?: number;
}

export type BotRunnerStatus = "running" | "paused";

const DEFAULT_TIMEOUT_MS = 5;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 10;

function isValidAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

export class BotRunner {
  private readonly timeoutMs: number;
  private readonly maxConsecutiveFailures: number;

  private runnerStatus: BotRunnerStatus = "running";
  private reason: string | null = null;
  private consecutiveFailures = 0;

  private nextTick = 0;
  private pendingTick: {
    tick: number;
    resolve: (action: Action) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor(
    private readonly worker: WorkerLike,
    options: BotRunnerOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxConsecutiveFailures =
      options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
  }

  get status(): BotRunnerStatus {
    return this.runnerStatus;
  }

  get pausedReason(): string | null {
    return this.reason;
  }

  init(sourceCode: string): void {
    const guardResult = checkStaticGuard(sourceCode);
    if (!guardResult.allowed) {
      this.pause(`statischer Guard abgelehnt: ${guardResult.matchedPattern}`);
      return;
    }
    this.worker.postMessage({ type: "init", code: sourceCode });
  }

  tick(state: BotState): Promise<Action> {
    if (this.runnerStatus === "paused") {
      return Promise.resolve("idle");
    }

    const tick = this.nextTick++;

    return new Promise<Action>((resolve) => {
      const timer = setTimeout(() => {
        this.resolvePendingTick(tick, "idle");
        this.registerFailure();
      }, this.timeoutMs);

      this.pendingTick = { tick, resolve, timer };
      this.worker.postMessage({ type: "tick", tick, state });
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.pause("disposed");
  }

  private handleWorkerMessage(message: WorkerToHostMessage): void {
    if (!this.pendingTick || message.tick !== this.pendingTick.tick) {
      // Verspätete oder nicht mehr erwartete Antwort – verwerfen (siehe Design,
      // Fehlerbehandlung "verspätete Antwort").
      return;
    }

    if (message.type === "action" && isValidAction(message.action)) {
      this.resolvePendingTick(message.tick, message.action);
      this.consecutiveFailures = 0;
      return;
    }

    // "error"-Message ODER Action außerhalb von ACTIONS.
    this.resolvePendingTick(message.tick, "idle");
    this.registerFailure();
  }

  private resolvePendingTick(tick: number, action: Action): void {
    if (!this.pendingTick || this.pendingTick.tick !== tick) {
      return;
    }
    clearTimeout(this.pendingTick.timer);
    this.pendingTick.resolve(action);
    this.pendingTick = null;
  }

  private registerFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.worker.terminate();
      this.pause("zu viele Fehlversuche in Folge");
    }
  }

  private pause(reason: string): void {
    this.runnerStatus = "paused";
    this.reason = reason;
  }
}
