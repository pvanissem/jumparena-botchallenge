import { MAX_BOT_TRACE_BYTES } from "./boundBotTrace";
import type { BotRunTrace } from "./types";

export async function writeBotTrace(trace: BotRunTrace): Promise<void> {
  const body = JSON.stringify(trace);
  if (new TextEncoder().encode(body).byteLength > MAX_BOT_TRACE_BYTES) {
    throw new Error("Trace exceeds 2 MiB");
  }
  const response = await fetch("/__bot-traces/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  if (!response.ok) throw new Error(`Trace konnte nicht gespeichert werden (${response.status})`);
}
