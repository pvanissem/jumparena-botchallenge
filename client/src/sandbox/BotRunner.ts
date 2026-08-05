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

/**
 * Strukturierter Pause-Grund (zusätzlich zum freien Text `pausedReason`) -
 * erlaubt der UI eine typsichere Verzweigung statt fragilem Teilstring-
 * Matching auf den Anzeigetext (siehe
 * `.features/dev-station-mode/design.md`, US-4).
 */
export type BotRunnerPauseReasonKind =
  | "guard-rejected"
  | "invalid-module"
  | "too-many-failures"
  | "disposed";

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
  private reasonKind: BotRunnerPauseReasonKind | null = null;
  private consecutiveFailures = 0;
  private runtimeError: string | null = null;

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

  get pausedReasonKind(): BotRunnerPauseReasonKind | null {
    return this.reasonKind;
  }

  /** Fehlertext der letzten `decide()`-Laufzeitausnahme, `null` sobald ein
   *  nachfolgender Tick wieder erfolgreich war (siehe `registerSuccess()`). */
  get lastRuntimeError(): string | null {
    return this.runtimeError;
  }

  /** Anzahl aufeinanderfolgender Fehlversuche (Timeout/Error/ungültige
   *  Action) seit dem letzten Erfolg - für eine frühzeitige UI-Warnung vor
   *  dem harten Kill bei `maxConsecutiveFailures`. */
  get consecutiveFailureCount(): number {
    return this.consecutiveFailures;
  }

  init(sourceCode: string): void {
    const guardResult = checkStaticGuard(sourceCode);
    if (!guardResult.allowed) {
      this.pause("guard-rejected", `statischer Guard abgelehnt: ${guardResult.matchedPattern}`);
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
        this.registerFailure(null);
      }, this.timeoutMs);

      this.pendingTick = { tick, resolve, timer };
      this.worker.postMessage({ type: "tick", tick, state });
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.pause("disposed", "disposed");
  }

  private handleWorkerMessage(message: WorkerToHostMessage): void {
    if (message.type === "module-invalid") {
      // Kein tick-Bezug (kann vor jedem tick()-Aufruf eintreffen) - deshalb
      // VOR der pendingTick-Korrelationsprüfung behandelt.
      this.pause("invalid-module", `ungültiges Bot-Modul: ${message.reason}`);
      return;
    }

    if (!this.pendingTick || message.tick !== this.pendingTick.tick) {
      // Verspätete oder nicht mehr erwartete Antwort – verwerfen (siehe Design,
      // Fehlerbehandlung "verspätete Antwort").
      return;
    }

    if (message.type === "action" && isValidAction(message.action)) {
      this.resolvePendingTick(message.tick, message.action);
      this.registerSuccess();
      return;
    }

    // "error"-Message ODER Action außerhalb von ACTIONS.
    this.resolvePendingTick(message.tick, "idle");
    this.registerFailure(message.type === "error" ? message.message : null);
  }

  private resolvePendingTick(tick: number, action: Action): void {
    if (!this.pendingTick || this.pendingTick.tick !== tick) {
      return;
    }
    clearTimeout(this.pendingTick.timer);
    this.pendingTick.resolve(action);
    this.pendingTick = null;
  }

  private registerFailure(errorMessage: string | null): void {
    if (errorMessage !== null) {
      this.runtimeError = errorMessage;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.worker.terminate();
      this.pause("too-many-failures", "zu viele Fehlversuche in Folge");
    }
  }

  private registerSuccess(): void {
    this.consecutiveFailures = 0;
    this.runtimeError = null;
  }

  private pause(kind: BotRunnerPauseReasonKind, reason: string): void {
    this.runnerStatus = "paused";
    this.reasonKind = kind;
    this.reason = reason;
  }
}
