/**
 * Test-Double für `WorkerLike` (kein Produktivcode – reine Test-Infrastruktur,
 * siehe `.features/bot-decide-api/tasks.md`, Task 3.2). Erlaubt Testcode, das
 * Antwortverhalten eines "Workers" vollständig zu steuern (verzögert/nie/mit
 * Fehler antworten), ohne einen echten Browser-Worker zu benötigen.
 */
import { vi } from "vitest";
import type { HostToWorkerMessage, WorkerLike, WorkerToHostMessage } from "../workerLike";

export class FakeWorker implements WorkerLike {
  readonly postMessage = vi.fn((message: HostToWorkerMessage) => {
    this.sentMessages.push(message);
  });
  readonly terminate = vi.fn();
  onmessage: (event: { data: WorkerToHostMessage }) => void = () => {};
  onerror?: (event: { message: string }) => void;
  onmessageerror?: (event: unknown) => void;

  readonly sentMessages: HostToWorkerMessage[] = [];

  /** Simuliert eine eingehende Nachricht vom Worker an den Host. */
  emit(message: WorkerToHostMessage): void {
    this.onmessage({ data: message });
  }
}
