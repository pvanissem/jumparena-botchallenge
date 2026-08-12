import type { TraceTickSample, TraceWindow } from "./types";

export interface TraceAnchor {
  tick: number;
  reason: string;
  required?: boolean;
}

export interface TraceWindowOptions {
  beforeTicks?: number;
  afterTicks?: number;
  maxWindows?: number;
}

export function selectTraceWindows(
  samples: readonly TraceTickSample[],
  anchors: readonly TraceAnchor[],
  options: TraceWindowOptions = {}
): TraceWindow[] {
  if (samples.length === 0) return [];
  const before = options.beforeTicks ?? 45;
  const after = options.afterTicks ?? 10;
  const maxWindows = options.maxWindows ?? 8;
  const first = samples[0].tick;
  const last = samples[samples.length - 1].tick;
  const intervals = anchors
    .map((anchor) => ({
      fromTick: Math.max(first, anchor.tick - before),
      toTick: Math.min(last, anchor.tick + after),
      reasons: [anchor.reason],
      required: anchor.required ?? false,
    }))
    .sort((a, b) => a.fromTick - b.fromTick);

  const merged: typeof intervals = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && interval.fromTick <= previous.toTick + 1) {
      previous.toTick = Math.max(previous.toTick, interval.toTick);
      previous.reasons.push(...interval.reasons);
      previous.required ||= interval.required;
    } else {
      merged.push(interval);
    }
  }

  const required = merged.filter((interval) => interval.required).slice(-1);
  const ordinaryLimit = required.length > 0 ? maxWindows - 1 : maxWindows;
  const selected =
    merged.length <= maxWindows
      ? merged
      : [
          ...merged.filter((interval) => !interval.required).slice(0, ordinaryLimit),
          ...required,
        ].sort((a, b) => a.fromTick - b.fromTick);

  return selected.map((interval) => ({
    fromTick: interval.fromTick,
    toTick: interval.toTick,
    reason: interval.reasons.join(", "),
    samples: samples.filter(
      (sample) => sample.tick >= interval.fromTick && sample.tick <= interval.toTick
    ),
  }));
}
