import { checkStaticGuard } from "@arena/bot-contract";
import { createBrowserWorker } from "./createBrowserWorker";
import type { WorkerLike, WorkerToHostMessage } from "./workerLike";

export type BotArtifactValidation =
  | { valid: true; name: string; author: string; color?: string; frameworkVersion?: 2 }
  | { valid: false; reason: string };

/**
 * Validates a bot source in the existing Worker sandbox and extracts the
 * metadata needed for the registry entry. Does NOT run any ticks - this is
 * purely the upload-time validation used by `/admin`.
 */
export function validateBotArtifact(
  sourceCode: string,
  fallbackName: string,
  createWorker: () => WorkerLike = createBrowserWorker,
  timeoutMs = 2000
): Promise<BotArtifactValidation> {
  const guardResult = checkStaticGuard(sourceCode);
  if (!guardResult.allowed) {
    return Promise.resolve({
      valid: false,
      reason: `statischer Guard abgelehnt: ${guardResult.matchedPattern}`,
    });
  }

  const worker = createWorker();

  return new Promise<BotArtifactValidation>((resolve) => {
    let settled = false;
    const finish = (result: BotArtifactValidation) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ valid: false, reason: `Timeout nach ${timeoutMs} ms` });
    }, timeoutMs);

    worker.onmessage = (event) => {
      const message: WorkerToHostMessage = event.data;
      if (message.type === "module-ready") {
        finish({
          valid: true,
          name: message.name || fallbackName.replace(/\.js$/i, ""),
          author: message.author || "unbekannt",
          color: message.color,
          ...(message.frameworkVersion !== undefined
            ? { frameworkVersion: message.frameworkVersion }
            : {}),
        });
      } else if (message.type === "module-invalid") {
        finish({ valid: false, reason: message.reason });
      }
      // action/error/tick messages are ignored - validation waits for the
      // module result or the timeout.
    };

    worker.onerror = (event) => finish({ valid: false, reason: event.message });
    worker.onmessageerror = () => finish({ valid: false, reason: "Worker-Nachricht nicht lesbar" });
    try {
      worker.postMessage({ type: "init", code: sourceCode });
    } catch (error) {
      finish({ valid: false, reason: String(error) });
    }
  });
}
