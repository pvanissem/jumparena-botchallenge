import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotRunner } from "./BotRunner";
import { FakeWorker } from "./testUtils/FakeWorker";
import { navigation, sampleState } from "./testUtils/sampleState";

const CODE = "export default { apiVersion: 1, decide() { return []; } };";

describe("BotRunner lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(ready = false) {
    const worker = new FakeWorker();
    const runner = new BotRunner(worker, { initTimeoutMs: 100 });
    runner.init(CODE);
    if (ready) worker.emit({ type: "module-ready" });
    return { worker, runner };
  }

  it("does not send or count ticks before readiness; resolves the shared barrier", async () => {
    const { worker, runner } = setup();
    const ready = runner.whenReady();
    expect(runner.whenReady()).toBe(ready);
    const settled = vi.fn();
    void ready.then(settled);
    await expect(runner.tick(sampleState)).resolves.toEqual([]);
    await vi.advanceTimersByTimeAsync(6);
    expect(settled).not.toHaveBeenCalled();
    expect(worker.sentMessages).toHaveLength(1);
    expect(runner.consecutiveFailureCount).toBe(0);
    worker.emit({ type: "module-ready" });
    await expect(ready).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves readiness false on init timeout and ignores late readiness", async () => {
    const { worker, runner } = setup();
    await vi.advanceTimersByTimeAsync(100);
    await expect(runner.whenReady()).resolves.toBe(false);
    expect(runner.pausedReasonKind).toBe("init-timeout");
    worker.emit({ type: "module-ready" });
    await expect(runner.tick(sampleState)).resolves.toEqual([]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it.each(["module-invalid", "worker-error", "message-error", "dispose"])(
    "settles initialization on %s",
    async (kind) => {
      const { worker, runner } = setup();
      if (kind === "module-invalid") worker.emit({ type: kind, reason: "bad module" });
      if (kind === "worker-error") worker.onerror?.({ message: "worker failed" });
      if (kind === "message-error") worker.onmessageerror?.({});
      if (kind === "dispose") runner.dispose();
      await expect(runner.whenReady()).resolves.toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
  );

  it("settles guard rejection and synchronous transport errors", async () => {
    const worker = new FakeWorker();
    const guarded = new BotRunner(worker);
    guarded.init("fetch('forbidden')");
    await expect(guarded.whenReady()).resolves.toBe(false);
    const broken = new BotRunner(worker);
    worker.postMessage.mockImplementation(() => {
      throw new Error("transport");
    });
    expect(() => broken.init(CODE)).not.toThrow();
    await expect(broken.whenReady()).resolves.toBe(false);
  });

  it("allows at most one pending request without losing the first promise", async () => {
    const { worker, runner } = setup(true);
    const first = runner.tick(sampleState);
    await expect(runner.tick(sampleState)).resolves.toEqual([]);
    expect(worker.sentMessages).toHaveLength(2);
    worker.emit({ type: "action", tick: 0, actions: ["right"] });
    await expect(first).resolves.toEqual(["right"]);
    expect(runner.consecutiveFailureCount).toBe(0);
  });

  it("settles a tick immediately when postMessage throws", async () => {
    const { worker, runner } = setup(true);
    worker.postMessage.mockImplementation(() => {
      throw new Error("clone failed");
    });
    await expect(runner.tick(sampleState)).resolves.toEqual([]);
    expect(runner.pausedReasonKind).toBe("worker-error");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores duplicate init, pre-init ready and calls after disposal", async () => {
    const worker = new FakeWorker();
    const runner = new BotRunner(worker);
    worker.emit({ type: "module-ready" });
    await expect(runner.tick(sampleState)).resolves.toEqual([]);
    runner.init(CODE);
    runner.init(CODE);
    expect(worker.sentMessages).toHaveLength(1);
    runner.dispose();
    runner.init(CODE);
    expect(worker.sentMessages).toHaveLength(1);
  });

  it.each(["dispose", "worker-error", "module-invalid"])(
    "immediately settles a pending tick on %s",
    async (kind) => {
      const { worker, runner } = setup(true);
      const pending = runner.tick(sampleState);
      if (kind === "dispose") runner.dispose();
      if (kind === "worker-error") worker.onerror?.({ message: "failed" });
      if (kind === "module-invalid") worker.emit({ type: kind, reason: "invalid" });
      await expect(pending).resolves.toEqual([]);
      runner.dispose();
      expect(worker.terminate).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("preserves the default 5ms roundtrip deadline", async () => {
    const { runner } = setup(true);
    const settled = vi.fn();
    const pending = runner.tick(sampleState);
    void pending.then(settled);
    await vi.advanceTimersByTimeAsync(4);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual([]);
    expect(runner.consecutiveFailureCount).toBe(1);
  });

  it("correlates epoch and state tick separately from request IDs", async () => {
    const { worker, runner } = setup(true);
    const pending = runner.tick({ ...sampleState, navigation });
    const settled = vi.fn();
    void pending.then(settled);
    expect(worker.sentMessages.at(-1)).toMatchObject({
      type: "tick",
      tick: 0,
      stateTick: 42,
      epoch: 2,
    });
    worker.emit({ type: "action", tick: 0, stateTick: 42, epoch: 1, actions: ["left"] });
    worker.emit({ type: "action", tick: 0, stateTick: 41, epoch: 2, actions: ["left"] });
    worker.emit({ type: "action", tick: 0, actions: ["left"] });
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    worker.emit({ type: "action", tick: 0, stateTick: 42, epoch: 2, actions: ["right"] });
    await expect(pending).resolves.toEqual(["right"]);
  });
});
