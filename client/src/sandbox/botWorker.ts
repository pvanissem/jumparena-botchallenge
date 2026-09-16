/**
 * Modul-Worker-Einstiegspunkt – läuft im Worker-Scope, kennt keine
 * `checkStaticGuard`-Prüfung (die läuft bereits vorher im `BotRunner`, bevor
 * überhaupt ein `init` gesendet wird) und validiert/normalisiert keine
 * Actions (das ist alleinige Aufgabe des `BotRunner`, siehe
 * `.features/bot-decide-api/design.md`).
 *
 * Die synchrone Ausfuehrung ist in der reinen botWorkerRuntime unit-getestet.
 */
import { createNavigator } from "@arena/bot-navigation";
import { createBotWorkerRuntime } from "./botWorkerRuntime";
import type { HostToWorkerMessage } from "./workerLike";

const runtime = createBotWorkerRuntime(createNavigator);
let initializing = false;

async function handleInit(code: string): Promise<void> {
  const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    const mod: { default: unknown } = await import(/* @vite-ignore */ blobUrl);
    self.postMessage(runtime.init(mod.default));
  } catch (err) {
    self.postMessage({ type: "module-invalid", reason: String(err) });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

self.onmessage = (event: MessageEvent<HostToWorkerMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    if (initializing) return;
    initializing = true;
    void handleInit(message.code);
    return;
  }
  if (message.type === "tick") {
    try {
      self.postMessage(runtime.tick(message));
    } catch (error) {
      self.postMessage({
        type: "error",
        tick: message.tick,
        stateTick: message.stateTick,
        stateFrame: message.stateFrame,
        epoch: message.epoch,
        message: String(error),
      });
    }
  }
};
