import { afterEach, describe, expect, it, vi } from "vitest";
import type { BotRunTrace } from "./types";
import { writeBotTrace } from "./writeBotTrace";

afterEach(() => vi.unstubAllGlobals());

describe("writeBotTrace", () => {
  it.each([1, 2] as const)(
    "posts v%i unchanged without the browser keepalive size limit",
    async (schemaVersion) => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
      vi.stubGlobal("fetch", fetch);
      const trace = {
        schemaVersion,
        run: { startedAt: "2026-08-12T10:00:00.000Z" },
      } as BotRunTrace;

      await writeBotTrace(trace);

      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith("/__bot-traces/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trace),
      });
    }
  );

  it("rejects oversized evidence instead of bounding the recorder output again", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const trace = {
      schemaVersion: 2,
      run: {},
      windows: [],
      findings: [],
      events: [{ details: { text: "\u00e4".repeat(1024 * 1024) } }],
    } as unknown as BotRunTrace;
    await expect(writeBotTrace(trace)).rejects.toThrow("Trace");
    expect(fetch).not.toHaveBeenCalled();
    expect(trace.events).toHaveLength(1);
    expect(trace.truncation).toBeUndefined();
  });

  it("rejects oversized metadata before sending rather than exceeding the hard cap", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      writeBotTrace({
        schemaVersion: 2,
        run: { levelId: "x".repeat(2 * 1024 * 1024) },
        windows: [],
        findings: [],
        events: [],
      } as unknown as BotRunTrace)
    ).rejects.toThrow("Trace");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws when the server rejects the trace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(writeBotTrace({ schemaVersion: 1 } as BotRunTrace)).rejects.toThrow("500");
  });
});
