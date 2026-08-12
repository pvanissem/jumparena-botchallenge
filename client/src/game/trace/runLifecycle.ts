import type { BotRunRecorder } from "./BotRunRecorder";
import type { BotRunTrace, RacerSummaryInput, RunResult } from "./types";

type RecorderLike = Pick<
  BotRunRecorder,
  "recordState" | "recordDecision" | "recordEvent" | "snapshot" | "finish"
>;
type RecorderFactory = (initial: RacerSummaryInput) => RecorderLike;

export class RunTelemetryLifecycle {
  current: RecorderLike | null;
  private elapsedSinceFlushMs = 0;
  private hasFlushed = false;

  constructor(
    private readonly factory: RecorderFactory | null,
    private readonly onTrace: ((trace: BotRunTrace) => void) | null,
    initial: RacerSummaryInput
  ) {
    this.current = factory?.(initial) ?? null;
  }

  finish(result: RunResult, reason: string, final: RacerSummaryInput): void {
    const trace = this.current?.finish(result, reason, final);
    if (trace) this.onTrace?.(trace);
    this.current = null;
    this.elapsedSinceFlushMs = 0;
    this.hasFlushed = false;
  }

  start(initial: RacerSummaryInput): void {
    if (this.current === null) {
      this.current = this.factory?.(initial) ?? null;
      this.elapsedSinceFlushMs = 0;
      this.hasFlushed = false;
    }
  }

  advance(deltaMs: number, current: RacerSummaryInput): void {
    if (this.current === null) return;
    this.elapsedSinceFlushMs += deltaMs;
    if (!this.hasFlushed) {
      const initialTrace = this.current.snapshot(current);
      if (initialTrace) {
        this.onTrace?.(initialTrace);
        this.hasFlushed = true;
      }
    }
    if (this.elapsedSinceFlushMs < 5_000) return;
    this.elapsedSinceFlushMs %= 5_000;
    const trace = this.current.snapshot(current);
    if (trace) this.onTrace?.(trace);
  }
}
