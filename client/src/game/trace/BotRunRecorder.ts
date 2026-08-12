import type { BotState } from "@arena/bot-contract";
import { analyzeBotRun } from "./analyzeBotRun";
import { compactBotTick } from "./compactBotTick";
import { selectTraceWindows } from "./selectTraceWindows";
import type {
  BotDecisionTrace,
  BotRunTrace,
  RacerSummaryInput,
  RunResult,
  TraceEvent,
  TraceEventInput,
  TraceTickSample,
  TraceTuning,
} from "./types";

export interface BotRunRecorderOptions {
  levelId: string;
  sessionId: string;
  botRevision: string;
  startedAt: string;
  initial: RacerSummaryInput;
}

export class BotRunRecorder {
  private readonly samples: TraceTickSample[] = [];
  private readonly events: TraceEvent[] = [];
  private tuning: TraceTuning = { tickMs: 33, minJumpHoldMs: 180 };
  private goalX: number | null = null;
  private baseTimeMs: number | null = null;
  private finished = false;

  constructor(private readonly options: BotRunRecorderOptions) {}

  recordState(state: BotState): void {
    if (this.finished) return;
    this.baseTimeMs ??= state.timeElapsedMs;
    const sample = compactBotTick(state);
    sample.timeMs = Math.max(0, sample.timeMs - Math.round(this.baseTimeMs));
    this.samples.push(sample);
    this.tuning = { tickMs: state.tuning.tickMs, minJumpHoldMs: state.tuning.minJumpHoldMs };
    this.goalX ??= state.position.x + state.goalDirection.dx;
  }

  recordDecision(result: BotDecisionTrace): void {
    const sample = this.samples.find((entry) => entry.tick === result.tick);
    if (sample) sample.decision = result;
  }

  recordEvent(input: TraceEventInput): void {
    if (this.finished) return;
    this.baseTimeMs ??= input.timeMs;
    this.events.push({
      ...input,
      timeMs: Math.max(0, input.timeMs - Math.round(this.baseTimeMs)),
      id: `event-${this.events.length + 1}`,
      observed: true,
    });
  }

  finish(result: RunResult, reason: string, final: RacerSummaryInput): BotRunTrace | null {
    if (this.finished) return null;
    if (this.samples.length === 0 && this.events.length === 0 && result === "aborted") return null;
    this.finished = true;

    return this.createTrace("completed", result, reason, final);
  }

  snapshot(current: RacerSummaryInput): BotRunTrace | null {
    if (this.finished || (this.samples.length === 0 && this.events.length === 0)) return null;
    return this.createTrace("running", null, null, current);
  }

  private createTrace(
    status: "running" | "completed",
    result: RunResult | null,
    reason: string | null,
    final: RacerSummaryInput
  ): BotRunTrace {
    const findings = analyzeBotRun(this.samples, this.events, this.tuning);
    const finalReason = status === "running" ? "live" : (result ?? "completed");
    const anchors = [
      ...this.events.map((event) => ({ tick: event.tick, reason: event.kind })),
      ...findings.flatMap((entry) =>
        entry.ticks.slice(0, 1).map((tick) => ({ tick, reason: entry.kind }))
      ),
      { tick: this.samples.at(-1)?.tick ?? 0, reason: finalReason, required: true },
    ];
    const startX = this.options.initial.position.x;
    const goalDistance = this.goalX === null ? 0 : this.goalX - startX;
    const furthestX = Math.max(startX, ...this.samples.map((sample) => sample.position.x));
    const maxProgress =
      goalDistance <= 0 ? 0 : Math.max(0, Math.min(1, (furthestX - startX) / goalDistance));
    const lastTime = this.samples.at(-1)?.timeMs ?? 0;
    const flushedAt = new Date().toISOString();

    return {
      schemaVersion: 1,
      run: {
        levelId: this.options.levelId,
        sessionId: this.options.sessionId,
        botRevision: this.options.botRevision,
        status,
        startedAt: this.options.startedAt,
        flushedAt,
        endedAt: status === "completed" ? flushedAt : null,
        result,
        endReason: reason,
        durationMs: lastTime,
        tuning: this.tuning,
      },
      summary: {
        startPosition: this.options.initial.position,
        endPosition: final.position,
        maxProgress,
        coinsCollected: final.coinsCollected - this.options.initial.coinsCollected,
        fruitScore: final.fruitScore - this.options.initial.fruitScore,
        technicalErrors: this.samples.filter(
          (sample) =>
            sample.decision?.kind === "runtime-error" || sample.decision?.kind === "timeout"
        ).length,
        deathCause: result === "death" ? reason : null,
      },
      events: this.events,
      findings,
      windows: selectTraceWindows(this.samples, anchors),
    };
  }
}
