import { describe, expect, it, vi } from "vitest";
import { validateBotArtifact } from "./validateBotArtifact";
import type { HostToWorkerMessage, WorkerLike, WorkerToHostMessage } from "./workerLike";

function createControllableWorker(): {
  worker: WorkerLike;
  emit: (message: WorkerToHostMessage) => void;
  received: { type: string; code: string }[];
} {
  const received: { type: string; code: string }[] = [];
  let onmessageHandler: ((event: { data: WorkerToHostMessage }) => void) | null = null;

  const worker: WorkerLike = {
    postMessage: (message: HostToWorkerMessage) => {
      if (message.type === "init") {
        received.push({ type: message.type, code: message.code });
      }
    },
    terminate: vi.fn(),
    set onmessage(handler: (event: { data: WorkerToHostMessage }) => void) {
      onmessageHandler = handler;
    },
  } as unknown as WorkerLike;

  return {
    worker,
    emit: (message) => onmessageHandler?.({ data: message }),
    received,
  };
}

describe("validateBotArtifact", () => {
  it("resolves with valid metadata when the worker reports module-ready", async () => {
    const { worker, emit } = createControllableWorker();

    const promise = validateBotArtifact("export default {}", "fallback.js", () => worker, 100);
    emit({ type: "module-ready", name: "Racer", author: "Max", color: "#ff0000" });

    await expect(promise).resolves.toEqual({
      valid: true,
      name: "Racer",
      author: "Max",
      color: "#ff0000",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("falls back to the file name when the module omits name", async () => {
    const { worker, emit } = createControllableWorker();

    const promise = validateBotArtifact("export default {}", "my-bot.js", () => worker, 100);
    emit({ type: "module-ready", author: "Max" });

    await expect(promise).resolves.toEqual({
      valid: true,
      name: "my-bot",
      author: "Max",
    });
  });

  it("falls back to 'unbekannt' when the module omits author", async () => {
    const { worker, emit } = createControllableWorker();

    const promise = validateBotArtifact("export default {}", "my-bot.js", () => worker, 100);
    emit({ type: "module-ready", name: "Racer" });

    await expect(promise).resolves.toEqual({
      valid: true,
      name: "Racer",
      author: "unbekannt",
    });
  });

  it("resolves with valid: false when the worker reports module-invalid", async () => {
    const { worker, emit } = createControllableWorker();

    const promise = validateBotArtifact("export default {}", "fallback.js", () => worker, 100);
    emit({ type: "module-invalid", reason: "decide fehlt" });

    await expect(promise).resolves.toEqual({
      valid: false,
      reason: "decide fehlt",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects immediately on a guard violation without starting a worker", async () => {
    const createWorker = vi.fn();

    const promise = validateBotArtifact("fetch('x');", "bad.js", createWorker, 100);

    await expect(promise).resolves.toEqual({
      valid: false,
      reason: expect.stringContaining("statischer Guard"),
    });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("resolves with valid: false on timeout and terminates the worker", async () => {
    vi.useFakeTimers();
    const { worker } = createControllableWorker();

    try {
      const promise = validateBotArtifact("export default {}", "fallback.js", () => worker, 50);
      await vi.advanceTimersByTimeAsync(50);

      await expect(promise).resolves.toEqual({
        valid: false,
        reason: expect.stringContaining("Timeout"),
      });
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminates the worker even when an unexpected message arrives", async () => {
    vi.useFakeTimers();
    const { worker, emit } = createControllableWorker();

    try {
      const promise = validateBotArtifact("export default {}", "fallback.js", () => worker, 100);
      // "action" is not relevant for validation.
      emit({ type: "action", tick: 0, actions: [] });

      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toEqual({
        valid: false,
        reason: expect.stringContaining("Timeout"),
      });
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
