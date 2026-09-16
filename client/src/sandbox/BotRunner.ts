/**
 * Sichere, timeout- und fehlertolerante Ausführung einer `decide(state)`-
 * Implementierung über einen Web Worker – siehe
 * `.features/bot-decide-api/design.md` für die vollständige Herleitung.
 */
import { ACTIONS, type Action, type BotState, checkStaticGuard } from "@arena/bot-contract";
import { validateNavigationDiagnostic } from "../game/trace/navigationDiagnostic";
import type { BotDecisionTrace } from "../game/trace/types";
import type { WorkerLike, WorkerToHostMessage } from "./workerLike";

export interface BotRunnerObserver {
  onDecision(result: BotDecisionTrace): void;
  onPaused(reason: BotRunnerPauseReasonKind, message: string | null): void;
}

export interface BotRunnerOptions {
  /** Zeitlimit pro Tick in ms, Default 5 (siehe docs/02-bot-api.md). */
  timeoutMs?: number;
  /** Separate deadline for loading/validating the module, default 2000 ms. */
  initTimeoutMs?: number;
  /** Schwelle aufeinanderfolgender Fehlversuche, Default 10 (siehe docs/09). */
  maxConsecutiveFailures?: number;
  observer?: BotRunnerObserver;
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
  | "init-timeout"
  | "worker-error"
  | "too-many-failures"
  | "disposed";

const DEFAULT_TIMEOUT_MS = 5;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 10;

function isValidAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

/**
 * Normalisiert einen beliebigen `decide`-Rückgabewert zu einer gültigen
 * Action-Liste (Single Source of Truth für Gültigkeit): kein Array → `[]`,
 * ungültige Elemente werden herausgefiltert. Ein leeres Ergebnis bedeutet
 * "nichts tun" und ist KEIN Fehlversuch (der Bot hat gültig geantwortet).
 */
function normalizeActions(value: unknown): Action[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isValidAction);
}

export class BotRunner {
  private readonly timeoutMs: number;
  private readonly initTimeoutMs: number;
  private readonly maxConsecutiveFailures: number;
  private readonly observer: BotRunnerObserver | undefined;

  private runnerStatus: BotRunnerStatus = "running";
  private reason: string | null = null;
  private reasonKind: BotRunnerPauseReasonKind | null = null;
  private consecutiveFailures = 0;
  private runtimeError: string | null = null;
  private initialized = false;
  private ready = false;
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private resolveReady!: (ready: boolean) => void;
  private readonly readyPromise = new Promise<boolean>((resolve) => {
    this.resolveReady = resolve;
  });

  private nextTick = 0;
  private pendingTick: {
    tick: number;
    stateTick: number;
    stateFrame: number | undefined;
    epoch: number | undefined;
    resolve: (actions: Action[]) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor(
    private readonly worker: WorkerLike,
    options: BotRunnerOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.initTimeoutMs = options.initTimeoutMs ?? 2000;
    this.maxConsecutiveFailures =
      options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
    this.observer = options.observer;
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
    this.worker.onerror = (event) => this.pause("worker-error", event.message);
    this.worker.onmessageerror = () => this.pause("worker-error", "Worker-Nachricht nicht lesbar");
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
    if (this.initialized || this.runnerStatus === "paused") return;
    this.initialized = true;
    const guardResult = checkStaticGuard(sourceCode);
    if (!guardResult.allowed) {
      this.pause("guard-rejected", `statischer Guard abgelehnt: ${guardResult.matchedPattern}`);
      return;
    }
    this.initTimer = setTimeout(() => {
      this.pause("init-timeout", `Initialisierung: Timeout nach ${this.initTimeoutMs} ms`);
    }, this.initTimeoutMs);
    try {
      this.worker.postMessage({ type: "init", code: sourceCode });
    } catch (error) {
      this.pause("worker-error", String(error));
    }
  }

  /** true after module-ready, false if initialization was terminated. */
  whenReady(): Promise<boolean> {
    return this.readyPromise;
  }

  tick(state: BotState): Promise<Action[]> {
    if (this.runnerStatus === "paused" || !this.ready || this.pendingTick) {
      return Promise.resolve([]);
    }

    const tick = this.nextTick++;
    const stateTick = state.tick;
    const epoch = state.navigation?.epoch;
    const stateFrame = state.navigation?.frame;

    return new Promise<Action[]>((resolve) => {
      const timer = setTimeout(() => {
        this.resolvePendingTick(tick, []);
        this.observer?.onDecision({
          tick,
          stateTick,
          epoch,
          stateFrame,
          kind: "timeout",
          actions: [],
        });
        this.registerFailure(null);
      }, this.timeoutMs);

      this.pendingTick = { tick, stateTick, epoch, stateFrame, resolve, timer };
      try {
        this.worker.postMessage({ type: "tick", tick, stateTick, epoch, stateFrame, state });
      } catch (error) {
        this.pause("worker-error", String(error));
      }
    });
  }

  dispose(): void {
    this.pause("disposed", "disposed");
  }

  private handleWorkerMessage(message: WorkerToHostMessage): void {
    if (this.runnerStatus === "paused") return;
    if (message.type === "module-invalid") {
      // Kein tick-Bezug (kann vor jedem tick()-Aufruf eintreffen) - deshalb
      // VOR der pendingTick-Korrelationsprüfung behandelt.
      this.pause("invalid-module", `ungültiges Bot-Modul: ${message.reason}`);
      return;
    }

    if (message.type === "module-ready") {
      if (!this.initialized) return;
      if (this.initTimer !== null) clearTimeout(this.initTimer);
      this.initTimer = null;
      this.ready = true;
      this.resolveReady(true);
      return;
    }

    if (
      !this.pendingTick ||
      message.tick !== this.pendingTick.tick ||
      message.epoch !== this.pendingTick.epoch ||
      (message.stateFrame !== undefined && message.stateFrame !== this.pendingTick.stateFrame) ||
      (message.stateTick !== undefined && message.stateTick !== this.pendingTick.stateTick) ||
      (this.pendingTick.epoch !== undefined && message.stateTick !== this.pendingTick.stateTick)
    ) {
      // Verspätete oder nicht mehr erwartete Antwort – verwerfen (siehe Design,
      // Fehlerbehandlung "verspätete Antwort").
      return;
    }

    const { tick, stateTick, stateFrame, epoch } = this.pendingTick;
    const correlation = { tick, stateTick, stateFrame, epoch };
    if (message.type === "action") {
      // Erfolgreiche Antwort (auch ein leeres Ergebnis nach Filterung ist ein
      // gültiges "nichts tun" – kein Fehlversuch).
      const actions = normalizeActions(message.actions);
      const navigation = validateNavigationDiagnostic(message.navigation, actions);
      this.resolvePendingTick(message.tick, actions);
      this.observer?.onDecision({
        ...correlation,
        kind: "ok",
        actions,
        ...(navigation ? { navigation } : {}),
      });
      this.registerSuccess();
      return;
    }

    // "error"-Message → Fehlversuch.
    this.resolvePendingTick(message.tick, []);
    if (message.type === "error") {
      this.observer?.onDecision({
        ...correlation,
        kind: "runtime-error",
        actions: [],
        message: message.message,
      });
    }
    this.registerFailure(message.type === "error" ? message.message : null);
  }

  private resolvePendingTick(tick: number, actions: Action[]): void {
    if (!this.pendingTick || this.pendingTick.tick !== tick) {
      return;
    }
    clearTimeout(this.pendingTick.timer);
    this.pendingTick.resolve(actions);
    this.pendingTick = null;
  }

  private registerFailure(errorMessage: string | null): void {
    if (errorMessage !== null) {
      this.runtimeError = errorMessage;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.pause("too-many-failures", "zu viele Fehlversuche in Folge");
    }
  }

  private registerSuccess(): void {
    this.consecutiveFailures = 0;
    this.runtimeError = null;
  }

  private pause(kind: BotRunnerPauseReasonKind, reason: string): void {
    if (this.runnerStatus === "paused") return;
    this.runnerStatus = "paused";
    this.reasonKind = kind;
    this.reason = reason;
    this.ready = false;
    if (this.initTimer !== null) clearTimeout(this.initTimer);
    this.initTimer = null;
    this.resolveReady(false);
    if (this.pendingTick) this.resolvePendingTick(this.pendingTick.tick, []);
    this.worker.terminate();
    this.observer?.onPaused(kind, reason);
  }
}
