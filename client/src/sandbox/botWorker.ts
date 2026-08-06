/**
 * Modul-Worker-Einstiegspunkt – läuft im Worker-Scope, kennt keine
 * `checkStaticGuard`-Prüfung (die läuft bereits vorher im `BotRunner`, bevor
 * überhaupt ein `init` gesendet wird) und validiert/normalisiert keine
 * Actions (das ist alleinige Aufgabe des `BotRunner`, siehe
 * `.features/bot-decide-api/design.md`).
 *
 * Bewusst nicht unit-getestet (jsdom bietet keine echte Worker-Isolation) –
 * siehe design.md, Abschnitt "Test-Strategie".
 */
import {
  type BotModule,
  type BotState,
  type DecideResult,
  validateBotModule,
} from "@arena/bot-contract";
import type { HostToWorkerMessage } from "./workerLike";

let decide: ((state: BotState) => DecideResult) | null = null;

async function handleInit(code: string): Promise<void> {
  const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    const mod: { default: unknown } = await import(/* @vite-ignore */ blobUrl);
    const validation = validateBotModule(mod.default);
    if (!validation.valid) {
      decide = null;
      self.postMessage({ type: "module-invalid", reason: validation.reason });
      return;
    }
    decide = (validation.module as BotModule).decide;
  } catch (err) {
    decide = null;
    self.postMessage({ type: "module-invalid", reason: String(err) });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function handleTick(tick: number, state: BotState): void {
  try {
    // decide() kann irgendetwas zurückgeben (auch Unsinn) – die
    // Normalisierung/Validierung ("ist das eine gültige Action-Liste?") liegt
    // bewusst NICHT hier, sondern ausschließlich im BotRunner (Single Source of
    // Truth). Hier wird das Ergebnis nur unverändert durchgereicht.
    const actions = decide ? decide(state) : [];
    self.postMessage({ type: "action", tick, actions });
  } catch (err) {
    self.postMessage({ type: "error", tick, message: String(err) });
  }
}

self.onmessage = (event: MessageEvent<HostToWorkerMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    void handleInit(message.code);
    return;
  }
  if (message.type === "tick") {
    handleTick(message.tick, message.state);
  }
};
