import { describe, expect, it, vi } from "vitest";
import { createBotWorkerRuntime } from "./botWorkerRuntime";
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
  it.each([1, 2])("uses the shared runtime validation for frameworkVersion %s", async (version) => {
    const { worker, emit, received } = createControllableWorker();
    const runtime = createBotWorkerRuntime(() => ({
      run: () => [],
      status: () => ({ commandId: null, state: "idle" as const, phase: null, reason: null }),
      reset() {},
    }));
    const source = `export default { apiVersion: 1, frameworkVersion: ${version}, decide() { return []; } };`;
    const result = validateBotArtifact(source, "tools.js", () => worker);
    emit(runtime.init({ apiVersion: 1, frameworkVersion: version, decide: () => [] }));
    expect(received).toEqual([{ type: "init", code: source }]);
    if (version === 2)
      await expect(result).resolves.toMatchObject({
        valid: true,
        name: "tools",
        frameworkVersion: 2,
      });
    else
      await expect(result).resolves.toEqual({
        valid: false,
        reason: "frameworkVersion 1 nicht unterstützt",
      });
  });

  it("does not infer framework metadata from legacy source comments", async () => {
    const { worker, emit } = createControllableWorker();
    const source =
      "/* frameworkVersion: 1 */ export default { apiVersion: 1, decide() { return []; } };";
    const result = validateBotArtifact(source, "legacy.js", () => worker);
    emit(createBotWorkerRuntime().init({ apiVersion: 1, decide: () => [] }));
    await expect(result).resolves.toMatchObject({ valid: true });
    expect(await result).not.toHaveProperty("frameworkVersion");
  });

  it("settles worker errors immediately and cleans up only once", async () => {
    const { worker, emit } = createControllableWorker();
    const result = validateBotArtifact("export default {}", "bad.js", () => worker);
    worker.onerror?.({ message: "load failed" });
    await expect(result).resolves.toEqual({ valid: false, reason: "load failed" });
    emit({ type: "module-ready" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("settles synchronous postMessage failures and terminates the worker", async () => {
    const { worker } = createControllableWorker();
    worker.postMessage = () => {
      throw new Error("clone failed");
    };
    await expect(validateBotArtifact("export default {}", "bad.js", () => worker)).resolves.toEqual(
      {
        valid: false,
        reason: "Error: clone failed",
      }
    );
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

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
