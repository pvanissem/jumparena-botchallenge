/**
 * Fabrik: erzeugt einen echten Browser-`Worker` (Vite-natives Worker-Bundling)
 * und gibt ihn als `WorkerLike` zurück – bewusst dünner Adapter ohne eigene
 * Verzweigungslogik. Event-Weiterleitung wird separat unit-getestet.
 */
import type { WorkerLike, WorkerToHostMessage } from "./workerLike";

export function createBrowserWorker(): WorkerLike {
  const worker = new Worker(new URL("./botWorker.ts", import.meta.url), {
    type: "module",
  });
  let onmessage: WorkerLike["onmessage"] = () => {};
  let onerror: WorkerLike["onerror"];
  let onmessageerror: WorkerLike["onmessageerror"];

  return {
    postMessage: (message) => worker.postMessage(message),
    terminate: () => worker.terminate(),
    get onmessage() {
      return onmessage;
    },
    set onmessage(handler: (event: { data: WorkerToHostMessage }) => void) {
      onmessage = handler;
      worker.onmessage = (event) => handler({ data: event.data });
    },
    get onerror() {
      return onerror;
    },
    set onerror(handler: ((event: { message: string }) => void) | undefined) {
      onerror = handler;
      worker.onerror = (event) => handler?.({ message: event.message });
    },
    get onmessageerror() {
      return onmessageerror;
    },
    set onmessageerror(handler: ((event: unknown) => void) | undefined) {
      onmessageerror = handler;
      worker.onmessageerror = (event) => handler?.(event);
    },
  };
}
