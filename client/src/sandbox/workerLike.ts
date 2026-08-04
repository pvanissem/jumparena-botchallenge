/**
 * Schmale Abstraktion über die echte `Worker`-API, damit `BotRunner`
 * testbar ist, ohne von `window.Worker` abzuhängen (Dependency Inversion,
 * siehe `.features/bot-decide-api/design.md`).
 */
import type { Action, BotState } from "@arena/bot-contract";

export interface WorkerLike {
  postMessage(message: HostToWorkerMessage): void;
  /**
   * Plain, überschreibbare Property – wie bei der echten `Worker`-Klasse
   * (`worker.onmessage = handler`), bewusst KEINE Getter/Setter-Accessor-
   * Deklaration (in TS-Interfaces syntaktisch ohnehin nicht zulässig).
   */
  onmessage: (event: { data: WorkerToHostMessage }) => void;
  terminate(): void;
}

export type HostToWorkerMessage =
  | { type: "init"; code: string }
  | { type: "tick"; tick: number; state: BotState };

/**
 * Bewusst OHNE "ready"-Message (YAGNI): Kein Akzeptanzkriterium verlangt,
 * dass der Host auf den Abschluss von `init` wartet.
 */
export type WorkerToHostMessage =
  | { type: "action"; tick: number; action: Action }
  | { type: "error"; tick: number; message: string };
