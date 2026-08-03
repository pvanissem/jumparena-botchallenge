export interface PingBroadcastMessage {
  type: "ping-broadcast";
  /** ISO-8601 timestamp, set by the sender */
  sentAt: string;
  /** Fixed text, e.g. "Ping von Admin" */
  text: string;
}

/**
 * Messages a client may send to the server.
 *
 * Deliberately just one variant for now (YAGNI) - extend this union when a
 * new inbound message type is actually needed by a requirement.
 */
export type InboundMessage = PingBroadcastMessage;

/**
 * Messages the server relays to other clients.
 */
export type OutboundMessage = PingBroadcastMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPingBroadcastMessage(value: unknown): value is PingBroadcastMessage {
  return (
    isRecord(value) &&
    value.type === "ping-broadcast" &&
    typeof value.sentAt === "string" &&
    typeof value.text === "string"
  );
}
