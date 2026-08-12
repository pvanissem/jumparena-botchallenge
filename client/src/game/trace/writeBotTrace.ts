import type { BotRunTrace } from "./types";

export async function writeBotTrace(trace: BotRunTrace): Promise<void> {
  const response = await fetch("/__bot-traces/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(trace),
  });
  if (!response.ok) throw new Error(`Trace konnte nicht gespeichert werden (${response.status})`);
}
