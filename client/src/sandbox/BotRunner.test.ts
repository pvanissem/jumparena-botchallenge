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
  sprintRampProgress: 0,
  nearbyTiles: [],
  platforms: [],
  tuning: {
    gravity: 900,
    tileSize: 16,
    tickMs: 33,
    baseMoveSpeed: 200,
    sprintMoveSpeed: 320,
    sprintRampMs: 450,
    baseJumpVelocity: -560,
    sprintJumpVelocity: -650,
    minJumpHoldMs: 180,
    botWidth: 24,
    botHeight: 32,
  },
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

describe("BotRunner module-ready handling", () => {
  it("accepts module-ready without affecting status or pausedReasonKind", () => {
    const worker = new FakeWorker();
    const runner = new BotRunner(worker);
    runner.init(VALID_CODE);

    worker.emit({ type: "module-ready", name: "Racer", author: "Max", color: "#ff0000" });

    expect(runner.status).toBe("running");
    expect(runner.pausedReasonKind).toBeNull();

    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["left"] });

    return expect(promise).resolves.toEqual(["left"]);
  });
});

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
    worker.emit({ type: "module-ready" });
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

  it("reports normalized actions to the optional observer", async () => {
    const observer = { onDecision: vi.fn(), onPaused: vi.fn() };
    const observedRunner = new BotRunner(worker, { observer });
    observedRunner.init(VALID_CODE);
    worker.emit({ type: "module-ready" });
    const promise = observedRunner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["jump", "fly"] as never });

    await expect(promise).resolves.toEqual(["jump"]);
    expect(observer.onDecision).toHaveBeenCalledWith({
      tick: 0,
      stateTick: 0,
      kind: "ok",
      actions: ["jump"],
    });
  });

  it.each(["runtime-error", "timeout"])(
    "reports and permanently stops on the first %s",
    async (kind) => {
      vi.useFakeTimers();
      try {
        const observer = { onDecision: vi.fn(), onPaused: vi.fn() };
        const observedRunner = new BotRunner(worker, { observer });
        observedRunner.init(VALID_CODE);
        worker.emit({ type: "module-ready" });
        const success = observedRunner.tick(SAMPLE_STATE);
        worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["right", "jump"] });
        await expect(success).resolves.toEqual(["right", "jump"]);
        observer.onDecision.mockClear();

        const pending = observedRunner.tick(SAMPLE_STATE);
        const failedTick = lastSentTick(worker);
        if (kind === "runtime-error") {
          worker.emit({ type: "error", tick: failedTick, message: "boom" });
        } else {
          await vi.advanceTimersByTimeAsync(100);
        }
        await expect(pending).resolves.toEqual([]);
        expect(observedRunner.status).toBe("paused");
        expect(observedRunner.consecutiveFailureCount).toBe(1);
        expect(worker.terminate).toHaveBeenCalledTimes(1);
        expect(observer.onDecision).toHaveBeenCalledWith({
          tick: 1,
          stateTick: 0,
          stateFrame: undefined,
          epoch: undefined,
          kind,
          actions: [],
          ...(kind === "runtime-error" ? { message: "boom" } : {}),
        });
        expect(observer.onPaused).toHaveBeenCalledTimes(1);

        worker.postMessage.mockClear();
        worker.emit({ type: "action", tick: failedTick, actions: ["right"] });
        worker.emit({ type: "module-ready" });
        await expect(observedRunner.tick(SAMPLE_STATE)).resolves.toEqual([]);
        expect(worker.postMessage).not.toHaveBeenCalled();
        expect(observer.onDecision).toHaveBeenCalledTimes(1);
        expect(observedRunner.lastRuntimeError).toBe(kind === "runtime-error" ? "boom" : null);
        observedRunner.dispose();
        expect(worker.terminate).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    }
  );

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
      await vi.advanceTimersByTimeAsync(100);
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
    expect(runner.status).toBe("paused");
  });

  it("resolves with an empty list (no failure) when all returned actions are invalid", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), actions: ["fly"] as never });

    await expect(promise).resolves.toEqual([]);
    expect(runner.consecutiveFailureCount).toBe(0);
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

  it("reports a pause exactly once", () => {
    const worker = new FakeWorker();
    const observer = { onDecision: vi.fn(), onPaused: vi.fn() };
    const runner = new BotRunner(worker, { observer });
    runner.init(GUARDED_CODE);

    expect(observer.onPaused).toHaveBeenCalledTimes(1);
    expect(observer.onPaused).toHaveBeenCalledWith(
      "guard-rejected",
      expect.stringContaining("Guard")
    );
  });
});
