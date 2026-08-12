import { afterEach, describe, expect, it, vi } from "vitest";
import type { BotRunTrace } from "./types";
import { writeBotTrace } from "./writeBotTrace";

afterEach(() => vi.unstubAllGlobals());

describe("writeBotTrace", () => {
  it("posts growing trace JSON without the browser keepalive size limit", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const trace = {
      schemaVersion: 1,
      run: { startedAt: "2026-08-12T10:00:00.000Z" },
    } as BotRunTrace;

    await writeBotTrace(trace);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/__bot-traces/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(trace),
    });
  });

  it("throws when the server rejects the trace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(writeBotTrace({ schemaVersion: 1 } as BotRunTrace)).rejects.toThrow("500");
  });
});
