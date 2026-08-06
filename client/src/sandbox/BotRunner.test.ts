import type { BotState } from "@arena/bot-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BotRunner } from "./BotRunner";
import { FakeWorker } from "./testUtils/FakeWorker";

const VALID_CODE = `
  export default {
    apiVersion: 1,
    decide(state) { return "idle"; },
  };
`;

const GUARDED_CODE = `fetch("https://example.com");`;

/** Liest die Tick-Nummer der zuletzt an den Worker gesendeten `tick`-Message. */
function lastSentTick(worker: FakeWorker): number {
  const lastMessage = worker.sentMessages.at(-1);
  if (lastMessage?.type !== "tick") {
    throw new Error("Erwartete zuvor gesendete tick-Message wurde nicht gefunden");
  }
  return lastMessage.tick;
}

describe("BotRunner.init", () => {
  let worker: FakeWorker;

  beforeEach(() => {
    worker = new FakeWorker();
  });

  it("rejects code that violates the static guard without starting the worker", () => {
    const runner = new BotRunner(worker);

    runner.init(GUARDED_CODE);

    expect(runner.status).toBe("paused");
    expect(runner.pausedReason).toBeTruthy();
    expect(runner.pausedReasonKind).toBe("guard-rejected");
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it("sends init to the worker for guard-compliant code", () => {
    const runner = new BotRunner(worker);

    runner.init(VALID_CODE);

    expect(runner.status).toBe("running");
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "init", code: VALID_CODE });
  });
});

const SAMPLE_STATE: BotState = {
  tick: 0,
  position: { x: 0, y: 0 },
  facing: "right",
  onGround: true,
  isAlive: true,
  velocity: { vx: 0, vy: 0 },
  isSprinting: false,
  nearbyTiles: [],
  nearestCoin: null,
  nearestHazard: null,
  nearestUtility: null,
  coins: [],
  hazards: [],
  utilities: [],
  goalDirection: { dx: 1, dy: 0 },
  gapAhead: { present: false, distance: null },
  worldBounds: { width: 400, height: 200 },
  justRespawned: false,
  tookDamage: false,
  coinsCollected: 0,
  livesRemaining: 3,
  timeElapsedMs: 0,
};

describe("BotRunner module-invalid handling", () => {
  it("pauses with pausedReasonKind 'invalid-module' when the worker reports an invalid module", () => {
    const worker = new FakeWorker();
    const runner = new BotRunner(worker);
    runner.init(VALID_CODE);

    worker.emit({ type: "module-invalid", reason: "decide ist keine Funktion" });

    expect(runner.status).toBe("paused");
    expect(runner.pausedReasonKind).toBe("invalid-module");
    expect(runner.pausedReason).toContain("decide ist keine Funktion");
  });

  it("handles module-invalid even without a pending tick", () => {
    const worker = new FakeWorker();
    const runner = new BotRunner(worker);
    runner.init(VALID_CODE);

    // Bewusst KEIN tick() zuvor aufgerufen - es existiert kein pendingTick.
    worker.emit({ type: "module-invalid", reason: "apiVersion 2 nicht unterstützt" });

    expect(runner.status).toBe("paused");
    expect(runner.pausedReasonKind).toBe("invalid-module");
  });
});

describe("BotRunner.tick", () => {
  let worker: FakeWorker;
  let runner: BotRunner;

  beforeEach(() => {
    worker = new FakeWorker();
    runner = new BotRunner(worker);
    runner.init(VALID_CODE);
  });

  it("resolves with the actions from a timely, valid worker response", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({
      type: "action",
      tick: lastSentTick(worker),
      actions: ["jump", "sprint-right"],
    });

    await expect(promise).resolves.toEqual(["jump", "sprint-right"]);
  });

  it("filters out invalid actions and keeps the valid ones", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({
      type: "action",
      tick: lastSentTick(worker),
      actions: ["jump", "fly", "right"] as never,
    });

    await expect(promise).resolves.toEqual(["jump", "right"]);
  });

  it("resolves with an empty list when the worker returns a non-array", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: "right" as never });

    await expect(promise).resolves.toEqual([]);
  });

  it("resolves with an empty list when the worker never responds (timeout)", async () => {
    vi.useFakeTimers();
    try {
      const promise = runner.tick(SAMPLE_STATE);
      await vi.advanceTimersByTimeAsync(10);
      await expect(promise).resolves.toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves with an empty list when the worker reports an error", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "error", tick: lastSentTick(worker), message: "boom" });

    await expect(promise).resolves.toEqual([]);
  });

  it("exposes the last runtime error reported by the worker", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "error", tick: lastSentTick(worker), message: "boom" });
    await promise;

    expect(runner.lastRuntimeError).toBe("boom");
    expect(runner.status).toBe("running");
  });

  it("clears lastRuntimeError after a subsequent successful tick", async () => {
    const failedPromise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "error", tick: lastSentTick(worker), message: "boom" });
    await failedPromise;

    const successPromise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["left"] });
    await successPromise;

    expect(runner.lastRuntimeError).toBeNull();
  });

  it("tracks consecutiveFailureCount and resets it on success", async () => {
    const first = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "error", tick: lastSentTick(worker), message: "boom" });
    await first;
    const second = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "error", tick: lastSentTick(worker), message: "boom again" });
    await second;

    expect(runner.consecutiveFailureCount).toBe(2);

    const successPromise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["left"] });
    await successPromise;

    expect(runner.consecutiveFailureCount).toBe(0);
  });

  it("resolves with an empty list (no failure) when all returned actions are invalid", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["fly"] as never });

    await expect(promise).resolves.toEqual([]);
    expect(runner.consecutiveFailureCount).toBe(0);
  });

  it("resets the failure counter after a success between failures", async () => {
    vi.useFakeTimers();
    try {
      // 9 Fehlversuche (unterhalb der Default-Schwelle von 10).
      for (let i = 0; i < 9; i++) {
        const promise = runner.tick(SAMPLE_STATE);
        await vi.advanceTimersByTimeAsync(10);
        await promise;
      }

      // Ein Erfolg dazwischen.
      const successPromise = runner.tick(SAMPLE_STATE);
      worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["left"] });
      await successPromise;

      // Erneut mehrere Fehlversuche unterhalb der Schwelle - kein Kill.
      for (let i = 0; i < 9; i++) {
        const promise = runner.tick(SAMPLE_STATE);
        await vi.advanceTimersByTimeAsync(10);
        await promise;
      }

      expect(worker.terminate).not.toHaveBeenCalled();
      expect(runner.status).toBe("running");
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminates the worker and pauses after maxConsecutiveFailures", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 10; i++) {
        const promise = runner.tick(SAMPLE_STATE);
        await vi.advanceTimersByTimeAsync(10);
        await promise;
      }

      expect(worker.terminate).toHaveBeenCalledTimes(1);
      expect(runner.status).toBe("paused");
      expect(runner.pausedReason).toBeTruthy();
      expect(runner.pausedReasonKind).toBe("too-many-failures");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns idle immediately without contacting the worker once paused", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 10; i++) {
        const promise = runner.tick(SAMPLE_STATE);
        await vi.advanceTimersByTimeAsync(10);
        await promise;
      }
    } finally {
      vi.useRealTimers();
    }

    worker.postMessage.mockClear();
    const actions = await runner.tick(SAMPLE_STATE);

    expect(actions).toEqual([]);
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it("ignores a late response for an already timed-out tick", async () => {
    vi.useFakeTimers();
    try {
      const firstPromise = runner.tick(SAMPLE_STATE);
      const firstSentTick = lastSentTick(worker);
      await vi.advanceTimersByTimeAsync(10);
      await expect(firstPromise).resolves.toEqual([]);

      const secondPromise = runner.tick(SAMPLE_STATE);
      const secondSentTick = lastSentTick(worker);

      // Verspätete Antwort auf den ERSTEN (bereits abgeschlossenen) Tick.
      worker.emit({ type: "action", tick: firstSentTick, actions: ["left"] });
      // Der zweite, noch offene Tick darf davon nicht beeinflusst werden.
      worker.emit({ type: "action", tick: secondSentTick, actions: ["right"] });

      await expect(secondPromise).resolves.toEqual(["right"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("BotRunner.dispose", () => {
  it("terminates the worker and pauses with reason 'disposed'", () => {
    const worker = new FakeWorker();
    const runner = new BotRunner(worker);
    runner.init(VALID_CODE);

    runner.dispose();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(runner.status).toBe("paused");
    expect(runner.pausedReason).toBe("disposed");
    expect(runner.pausedReasonKind).toBe("disposed");
  });
});
