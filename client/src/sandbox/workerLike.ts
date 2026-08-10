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
 * `module-ready` ist KEIN generisches "ready"-Signal, sondern liefert die
 * vom Bot-Modul deklarierten Metadaten (name/author/color). Sie wird
 * eingeführt, weil `bot-collection-point` US-2 explizit verlangt, diese
 * Werte aus dem geladenen Modul auszulesen, ohne sie per Formular erfragen
 * zu müssen. `module-invalid` bleibt die Ausnahme für fehlerhafte Module
 * (siehe `.features/dev-station-mode/design.md`, US-4).
 */
export type WorkerToHostMessage =
  | { type: "action"; tick: number; actions: Action[] }
  | { type: "error"; tick: number; message: string }
  | { type: "module-invalid"; reason: string }
  | { type: "module-ready"; name?: string; author?: string; color?: string };
