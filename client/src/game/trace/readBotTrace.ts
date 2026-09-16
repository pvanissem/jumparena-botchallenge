import type { BotRunTrace, TraceTickSample } from "./types";

const span = (ticks: number[]) => ({
  from: ticks[0] ?? null,
  to: ticks.at(-1) ?? null,
  count: ticks.length,
});
const clipped = <T>(items: readonly T[], limit: number) => ({
  items: items.slice(0, limit),
  omitted: Math.max(0, items.length - limit),
});
const identity = (trace: BotRunTrace, revision: string) => ({
  currentCode: trace.run.botRevision === revision,
  expectedRevision: revision,
  attempt: trace.run,
  traceTruncation: trace.truncation ?? null,
});

/** Projection only: findings remain hints, not newly asserted root causes. */
export function summarizeTrace(trace: BotRunTrace, revision: string) {
  return {
    ...identity(trace, revision),
    summary: trace.summary,
    hints: trace.findings.slice(0, 5).map((f) => ({ ...f, ticks: span(f.ticks) })),
    omittedHints: Math.max(0, trace.findings.length - 5),
    recentEvents: trace.events.slice(-6),
    omittedEvents: Math.max(0, trace.events.length - 6),
    windows: clipped(
      trace.windows.map((w) => ({
        from: w.fromTick,
        to: w.toTick,
        reason: w.reason,
        storedSamples: w.samples.length,
      })),
      8
    ),
  };
}

function timelineSample(s: TraceTickSample) {
  return {
    tick: s.tick,
    timeMs: s.timeMs,
    position: s.position,
    velocity: s.velocity,
    onGround: s.onGround,
    actions: s.decision?.actions ?? null,
    decisionKind: s.decision?.kind ?? null,
    ...(s.decision?.kind === "runtime-error" ? { error: s.decision.message } : {}),
    command: s.decision?.navigation?.planId ?? null,
    phase: s.decision?.navigation?.phase ?? null,
    reason: s.decision?.navigation?.reason ?? null,
  };
}

export function focusTrace(trace: BotRunTrace, tick: number, revision: string) {
  const unique = new Map<number, TraceTickSample>();
  for (const window of trace.windows)
    for (const sample of window.samples) unique.set(sample.tick, sample);
  const samples = [...unique.values()].sort((a, b) => a.tick - b.tick);
  const nearby = samples.filter((s) => Math.abs(s.tick - tick) <= 15);
  const nearest = samples.reduce<TraceTickSample | null>(
    (best, s) => (!best || Math.abs(s.tick - tick) < Math.abs(best.tick - tick) ? s : best),
    null
  );
  const chosen = new Map<number, TraceTickSample>();
  if (nearby.length) {
    for (let i = 0; i < Math.min(6, nearby.length); i++) {
      const sample =
        nearby[Math.round((i * (nearby.length - 1)) / Math.max(1, Math.min(6, nearby.length) - 1))];
      chosen.set(sample.tick, sample);
    }
    if (nearest) chosen.set(nearest.tick, nearest);
  }
  const s = nearby.length ? nearest : null;
  const ids = new Set([
    s?.decision?.navigation?.targetId,
    ...(s?.decision?.navigation?.relevantObjectIds ?? []),
  ]);
  function objects<T extends { id?: string; dx: number; dy: number }>(list: readonly T[]) {
    return clipped(
      [...list].sort(
        (a, b) =>
          Number(ids.has(b.id)) - Number(ids.has(a.id)) ||
          Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy)
      ),
      6
    );
  }
  return {
    ...identity(trace, revision),
    coverage: {
      requestedTick: tick,
      requestedRange: [Math.max(0, tick - 15), tick + 15],
      exactTickAvailable: unique.has(tick),
      nearestTick: nearest?.tick ?? null,
      availableSamples: nearby.length,
      shownSamples: chosen.size,
      missingTicks: Math.max(0, tick + 15 - Math.max(0, tick - 15) + 1 - nearby.length),
    },
    timeline: [...chosen.values()].sort((a, b) => a.tick - b.tick).map(timelineSample),
    snapshot: s
      ? {
          tick: s.tick,
          position: s.position,
          body: s.navigation?.body ?? null,
          sprintRampProgress: s.sprintRampProgress,
          gapAhead: s.gapAhead,
          goalDirection: s.goalDirection,
          lastImpulse: s.navigation?.lastImpulse ?? null,
          decision: s.decision,
          hazards: objects(s.hazards),
          platforms: objects(s.platforms),
          coins: objects(s.coins),
          utilities: s.utilities ? objects(s.utilities) : null,
          checkpoints: s.checkpoints ? objects(s.checkpoints) : null,
          respawnPoint: s.respawnPoint ?? null,
        }
      : null,
  };
}

function compactOutput(value: unknown, limit: number, depth = 0): unknown {
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (value === null || typeof value !== "object") return value;
  if (depth >= 8) return "[Detail ausgelassen]";
  if (Array.isArray(value))
    return value.slice(0, limit).map((item) => compactOutput(item, limit, depth + 1));
  const source = value as Record<string, unknown>;
  const result = Object.fromEntries(
    Object.entries(source)
      .slice(0, 24)
      .map(([key, item]) => [key, compactOutput(item, limit, depth + 1)])
  );
  if (Array.isArray(source.items) && typeof source.omitted === "number")
    result.omitted = source.omitted + Math.max(0, source.items.length - limit);
  return result;
}

export function serializeReport(report: unknown): string {
  const json = JSON.stringify(report);
  if (json.length <= 12000) return json;
  const nextStep =
    "Diese Kurzdiagnose direkt auswerten. Fehlende Evidenz benennen; keine Umleitung, temporären Dateien oder zusätzlichen Dateirechte verwenden.";
  for (const limit of [6, 3, 1]) {
    const reduced = compactOutput(report, limit) as Record<string, unknown>;
    const original = report as Record<string, unknown>;
    for (const [list, count] of [
      ["hints", "omittedHints"],
      ["recentEvents", "omittedEvents"],
    ]) {
      if (Array.isArray(original[list]) && Array.isArray(reduced[list])) {
        reduced[count] =
          Number(original[count] ?? 0) + original[list].length - reduced[list].length;
      }
    }
    if (reduced.coverage && Array.isArray(reduced.timeline)) {
      (reduced.coverage as Record<string, unknown>).shownSamples = reduced.timeline.length;
    }
    const result = JSON.stringify({
      ...reduced,
      outputLimited: true,
      reduction: { maxListItems: limit, maxStringCharacters: 200, detailsMayBeOmitted: true },
      nextStep,
    });
    if (result.length <= 12000) return result;
  }
  // Pathological input still retains the small set of fields needed to identify the attempt.
  const source = report as Record<string, unknown>;
  const scalar = (v: unknown) =>
    typeof v === "string"
      ? v.slice(0, 200)
      : typeof v === "number" || typeof v === "boolean"
        ? v
        : null;
  const attempt = source?.attempt as Record<string, unknown> | undefined;
  const summary = source?.summary as Record<string, unknown> | undefined;
  return JSON.stringify({
    file: scalar(source?.file),
    currentCode: scalar(source?.currentCode),
    attempt: {
      sessionId: scalar(attempt?.sessionId),
      botRevision: scalar(attempt?.botRevision),
      result: scalar(attempt?.result),
    },
    summary: {
      deathCause: scalar(summary?.deathCause),
      technicalErrors: scalar(summary?.technicalErrors),
    },
    outputLimited: true,
    detailsOmitted: true,
    nextStep,
  });
}
