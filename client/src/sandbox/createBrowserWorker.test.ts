import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserWorker } from "./createBrowserWorker";
import type { WorkerToHostMessage } from "./workerLike";

describe("browser worker adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads back the exact message handler and permits wrapping and replacement", () => {
    const native = {
      onmessage: null as ((event: { data: WorkerToHostMessage }) => void) | null,
    };
    vi.stubGlobal(
      "Worker",
      vi.fn(() => native)
    );
    const worker = createBrowserWorker();
    const original = vi.fn();
    worker.onmessage = original;
    expect(worker.onmessage).toBe(original);
    const saved = worker.onmessage;
    const wrapper = vi.fn((event) => saved(event));
    worker.onmessage = wrapper;
    expect(worker.onmessage).toBe(wrapper);
    const event = { data: { type: "module-ready" as const, frameworkVersion: 2 as const } };
    native.onmessage?.(event);
    expect(wrapper.mock.calls).toEqual([[event]]);
    expect(original.mock.calls).toEqual([[event]]);
    const replacement = vi.fn();
    worker.onmessage = replacement;
    native.onmessage?.(event);
    expect(replacement.mock.calls).toEqual([[event]]);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it.each(["onerror", "onmessageerror"] as const)(
    "supports reading, wrapping and clearing %s",
    (key) => {
      const native = {
        onerror: null as ((event: { message: string }) => void) | null,
        onmessageerror: null as ((event: { message: string }) => void) | null,
      };
      vi.stubGlobal(
        "Worker",
        vi.fn(() => native)
      );
      const worker = createBrowserWorker();
      expect(worker[key]).toBeUndefined();
      const original = vi.fn();
      worker[key] = original;
      expect(worker[key]).toBe(original);
      const saved = worker[key];
      const wrapper = vi.fn((event) => saved?.(event));
      worker[key] = wrapper;
      expect(worker[key]).toBe(wrapper);
      native[key]?.({ message: "failed" });
      expect(original.mock.calls).toEqual([[{ message: "failed" }]]);
      worker[key] = undefined;
      expect(worker[key]).toBeUndefined();
      native[key]?.({ message: "ignored" });
      expect(original).toHaveBeenCalledTimes(1);
    }
  );

  it("forwards worker errors and message deserialization failures to the runner", () => {
    const native = {
      onerror: null as ((event: { message: string }) => void) | null,
      onmessageerror: null as ((event: unknown) => void) | null,
    };
    vi.stubGlobal(
      "Worker",
      vi.fn(() => native)
    );
    const worker = createBrowserWorker();
    const onerror = vi.fn();
    const onmessageerror = vi.fn();
    worker.onerror = onerror;
    worker.onmessageerror = onmessageerror;
    native.onerror?.({ message: "load failed" });
    native.onmessageerror?.({ type: "messageerror" });
    expect(onerror).toHaveBeenCalledWith({ message: "load failed" });
    expect(onmessageerror).toHaveBeenCalledWith({ type: "messageerror" });
  });
});
