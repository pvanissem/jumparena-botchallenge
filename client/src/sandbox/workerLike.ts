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
 * dass der Host auf den Abschluss von `init` wartet. `module-invalid` ist
 * die eine Ausnahme, in der der Host explizit informiert werden muss (siehe
 * `.features/dev-station-mode/design.md`, US-4): ein ungültiges Bot-Modul
 * (fehlendes `decide`, falsche `apiVersion`, Parse-Fehler) würde sonst still
 * bei jedem Tick nur `idle` liefern, ohne dass das je sichtbar wird.
 */
export type WorkerToHostMessage =
  | { type: "action"; tick: number; actions: Action[] }
  | { type: "error"; tick: number; message: string }
  | { type: "module-invalid"; reason: string };
