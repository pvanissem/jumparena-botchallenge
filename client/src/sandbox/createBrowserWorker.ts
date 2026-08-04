/**
 * Fabrik: erzeugt einen echten Browser-`Worker` (Vite-natives Worker-Bundling)
 * und gibt ihn als `WorkerLike` zurück – bewusst dünner Adapter ohne eigene
 * Verzweigungslogik (siehe design.md, Abschnitt "Test-Strategie": nicht
 * unit-getestet, nur manuell verifiziert).
 */
import type { WorkerLike, WorkerToHostMessage } from "./workerLike";

export function createBrowserWorker(): WorkerLike {
  const worker = new Worker(new URL("./botWorker.ts", import.meta.url), {
    type: "module",
  });

  return {
    postMessage: (message) => worker.postMessage(message),
    terminate: () => worker.terminate(),
    set onmessage(handler: (event: { data: WorkerToHostMessage }) => void) {
      worker.onmessage = (event) => handler({ data: event.data });
    },
  } as WorkerLike;
}
