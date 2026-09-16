import type { BotRunTrace } from "./types";

export const MAX_BOT_TRACE_BYTES = 2 * 1024 * 1024;

/** Keep recent/terminal evidence first; never imply that a shortened trace is complete. */
export function boundBotTrace(input: BotRunTrace): BotRunTrace {
  const trace = structuredClone(input);
  trace.schemaVersion = 2;
  const size = () => new TextEncoder().encode(JSON.stringify(trace)).byteLength;
  if (size() <= MAX_BOT_TRACE_BYTES) return trace;
  trace.truncation ??= { reasons: [], omittedSamples: 0, omittedEvents: 0, omittedFindings: 0 };
  if (!trace.truncation.reasons.includes("byte-limit")) trace.truncation.reasons.push("byte-limit");

  // Account for each entry once, avoiding repeated serialization of a large run.
  let bytes = size();
  for (const window of trace.windows ?? []) {
    while (bytes > MAX_BOT_TRACE_BYTES && window.samples.length > 0) {
      const removed = window.samples.shift();
      bytes -= new TextEncoder().encode(JSON.stringify(removed)).byteLength;
      trace.truncation.omittedSamples++;
    }
    if (window.samples.length) window.fromTick = window.samples[0].tick;
  }
  trace.windows = trace.windows?.filter((window) => window.samples.length > 0);
  for (const [entries, count] of [
    [trace.events, "omittedEvents"],
    [trace.findings, "omittedFindings"],
  ] as const) {
    while (bytes > MAX_BOT_TRACE_BYTES && entries?.length) {
      const removed = entries.shift();
      bytes -= new TextEncoder().encode(JSON.stringify(removed)).byteLength;
      trace.truncation[count]++;
    }
  }
  if (size() > MAX_BOT_TRACE_BYTES) throw new Error("Trace metadata exceeds 2 MiB");
  return trace;
}
