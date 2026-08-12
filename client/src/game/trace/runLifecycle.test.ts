import { describe, expect, it, vi } from "vitest";
import { RunTelemetryLifecycle } from "./runLifecycle";
import type { BotRunTrace, RacerSummaryInput, RunResult } from "./types";

const summary: RacerSummaryInput = { position: { x: 1, y: 2 }, coinsCollected: 0, fruitScore: 0 };

describe("RunTelemetryLifecycle", () => {
  it("finishes a death once and starts a fresh recorder only after respawn", () => {
    const onTrace = vi.fn();
    const finishes: RunResult[] = [];
    const factory = vi.fn(() => ({
      finish: (result: RunResult) => {
        finishes.push(result);
        return { schemaVersion: 1 } as BotRunTrace;
      },
    }));
    const lifecycle = new RunTelemetryLifecycle(factory as never, onTrace, summary);

    lifecycle.finish("death", "pit-fall", summary);
    expect(factory).toHaveBeenCalledTimes(1);
    lifecycle.start({ ...summary, position: { x: 20, y: 30 } });
    lifecycle.finish("finished", "goal", summary);

    expect(finishes).toEqual(["death", "finished"]);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(onTrace).toHaveBeenCalledTimes(2);
  });

  it("does nothing when telemetry is disabled", () => {
    const factory = vi.fn();
    const lifecycle = new RunTelemetryLifecycle(null, null, summary);

    lifecycle.finish("death", "pit-fall", summary);

    expect(factory).not.toHaveBeenCalled();
    expect(lifecycle.current).toBeNull();
  });

  it("flushes one running snapshot every five seconds and finalizes the same attempt", () => {
    const traces: BotRunTrace[] = [];
    const running = { schemaVersion: 1, run: { status: "running" } } as BotRunTrace;
    const completed = { schemaVersion: 1, run: { status: "completed" } } as BotRunTrace;
    const factory = () => ({
      snapshot: () => running,
      finish: () => completed,
    });
    const lifecycle = new RunTelemetryLifecycle(
      factory as never,
      (trace) => traces.push(trace),
      summary
    );

    lifecycle.advance(0, summary);
    expect(traces.map((trace) => trace.run.status)).toEqual(["running"]);
    lifecycle.advance(4_999, summary);
    expect(traces).toHaveLength(1);
    lifecycle.advance(1, summary);
    lifecycle.advance(5_000, summary);
    lifecycle.finish("death", "pit-fall", summary);

    expect(traces.map((trace) => trace.run.status)).toEqual([
      "running",
      "running",
      "running",
      "completed",
    ]);
  });
});
