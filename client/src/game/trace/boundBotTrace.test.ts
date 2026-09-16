import { describe, expect, it } from "vitest";
import { boundBotTrace, MAX_BOT_TRACE_BYTES } from "./boundBotTrace";
import type { BotRunTrace } from "./types";

describe("boundBotTrace", () => {
  it("counts truncation metadata even at the exact byte boundary", () => {
    const trace = {
      schemaVersion: 2,
      run: { levelId: "" },
      windows: [],
      findings: [],
      events: [{ id: "a".repeat(1000) }, { id: "b" }, { id: "c" }],
    } as unknown as BotRunTrace;
    // Removing just one small entry must not overlook the growing omission counter.
    const withMarker = {
      ...trace,
      truncation: {
        reasons: ["byte-limit"],
        omittedSamples: 0,
        omittedEvents: 0,
        omittedFindings: 0,
      },
    };
    trace.run.levelId = "x".repeat(MAX_BOT_TRACE_BYTES - JSON.stringify(withMarker).length + 1020);
    expect(() => boundBotTrace(trace)).not.toThrow();
    const result = boundBotTrace(trace);
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThanOrEqual(
      MAX_BOT_TRACE_BYTES
    );
    expect(result.truncation?.omittedEvents).toBeGreaterThan(0);
  });

  it("caps large event and finding payloads without mutating the input", () => {
    const trace = {
      schemaVersion: 2,
      run: {},
      windows: [],
      events: [{ details: { text: "x".repeat(MAX_BOT_TRACE_BYTES) } }],
      findings: [{ message: "x".repeat(MAX_BOT_TRACE_BYTES) }],
    } as unknown as BotRunTrace;
    const result = boundBotTrace(trace);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(MAX_BOT_TRACE_BYTES);
    expect(result.truncation).toMatchObject({ omittedEvents: 1, omittedFindings: 1 });
    expect(trace.events).toHaveLength(1);
    expect(trace.findings).toHaveLength(1);
  });
});
