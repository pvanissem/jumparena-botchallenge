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
  nearbyTiles: [],
  nearestCoin: null,
  nearestHazard: null,
  nearestUtility: null,
  goalDirection: { dx: 1, dy: 0 },
  coinsCollected: 0,
  livesRemaining: 3,
  timeElapsedMs: 0,
};

describe("BotRunner.tick", () => {
  let worker: FakeWorker;
  let runner: BotRunner;

  beforeEach(() => {
    worker = new FakeWorker();
    runner = new BotRunner(worker);
    runner.init(VALID_CODE);
  });

  it("resolves with the action from a timely, valid worker response", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), action: "jump" });

    await expect(promise).resolves.toBe("jump");
  });

  it("resolves with idle when the worker never responds (timeout)", async () => {
    vi.useFakeTimers();
    try {
      const promise = runner.tick(SAMPLE_STATE);
      await vi.advanceTimersByTimeAsync(10);
      await expect(promise).resolves.toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves with idle when the worker reports an error", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "error", tick: lastSentTick(worker), message: "boom" });

    await expect(promise).resolves.toBe("idle");
  });

  it("resolves with idle when the worker returns an action outside ACTIONS", async () => {
    const promise = runner.tick(SAMPLE_STATE);
    worker.emit({ type: "action", tick: lastSentTick(worker), action: "fly" as never });

    await expect(promise).resolves.toBe("idle");
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
      worker.emit({ type: "action", tick: lastSentTick(worker), action: "left" });
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
    const action = await runner.tick(SAMPLE_STATE);

    expect(action).toBe("idle");
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it("ignores a late response for an already timed-out tick", async () => {
    vi.useFakeTimers();
    try {
      const firstPromise = runner.tick(SAMPLE_STATE);
      const firstSentTick = lastSentTick(worker);
      await vi.advanceTimersByTimeAsync(10);
      await expect(firstPromise).resolves.toBe("idle");

      const secondPromise = runner.tick(SAMPLE_STATE);
      const secondSentTick = lastSentTick(worker);

      // Verspätete Antwort auf den ERSTEN (bereits abgeschlossenen) Tick.
      worker.emit({ type: "action", tick: firstSentTick, action: "left" });
      // Der zweite, noch offene Tick darf davon nicht beeinflusst werden.
      worker.emit({ type: "action", tick: secondSentTick, action: "right" });

      await expect(secondPromise).resolves.toBe("right");
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
  });
});
