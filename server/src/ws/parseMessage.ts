import { type InboundMessage, isPingBroadcastMessage } from "@arena/shared";

/**
 * Parses and validates a raw WebSocket payload into a typed InboundMessage.
 * Returns null for malformed JSON or unrecognized message shapes, so callers
 * can drop invalid messages without crashing (see design.md "Fehlerbehandlung").
 */
export function parseInboundMessage(raw: string): InboundMessage | null {
  let candidate: unknown;

  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }

  if (isPingBroadcastMessage(candidate)) {
    return candidate;
  }

  return null;
}
