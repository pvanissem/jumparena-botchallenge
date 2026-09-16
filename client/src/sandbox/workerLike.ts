/**
 * Schmale Abstraktion über die echte `Worker`-API, damit `BotRunner`
 * testbar ist, ohne von `window.Worker` abzuhängen (Dependency Inversion,
 * siehe `.features/bot-decide-api/design.md`).
 */
import type { BotState } from "@arena/bot-contract";

export interface WorkerLike {
  postMessage(message: HostToWorkerMessage): void;
  /**
   * Plain, überschreibbare Property – wie bei der echten `Worker`-Klasse
   * (`worker.onmessage = handler`), bewusst KEINE Getter/Setter-Accessor-
   * Deklaration (in TS-Interfaces syntaktisch ohnehin nicht zulässig).
   */
  onmessage: (event: { data: WorkerToHostMessage }) => void;
  onerror?: (event: { message: string }) => void;
  onmessageerror?: (event: unknown) => void;
  terminate(): void;
}

/** tick is a transport request ID; stateTick and epoch identify the observation. */
export interface TickCorrelation {
  tick: number;
  stateTick?: number;
  stateFrame?: number;
  epoch?: number;
}

export type HostToWorkerMessage =
  | { type: "init"; code: string }
  | ({ type: "tick"; state: BotState } & TickCorrelation);

/**
 * `module-ready` ist KEIN generisches "ready"-Signal, sondern liefert die
 * vom Bot-Modul deklarierten Metadaten (name/author/color). Sie wird
 * eingeführt, weil `bot-collection-point` US-2 explizit verlangt, diese
 * Werte aus dem geladenen Modul auszulesen, ohne sie per Formular erfragen
 * zu müssen. `module-invalid` bleibt die Ausnahme für fehlerhafte Module
 * (siehe `.features/dev-station-mode/design.md`, US-4).
 */
export type WorkerToHostMessage =
  | ({ type: "action"; actions: unknown; navigation?: unknown } & TickCorrelation)
  | ({ type: "error"; message: string } & TickCorrelation)
  | { type: "module-invalid"; reason: string }
  | {
      type: "module-ready";
      name?: string;
      author?: string;
      color?: string;
      /** Optional declaration from the validated module, absent for legacy bots. */
      frameworkVersion?: 1;
    };
