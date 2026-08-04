export interface PingBroadcastMessage {
  type: "ping-broadcast";
  /** ISO-8601 timestamp, set by the sender */
  sentAt: string;
  /** Fixed text, e.g. "Ping von Admin" */
  text: string;
}

/**
 * Master audio settings (music + sound effects share a single volume), sent
 * by the Admin view and relayed to all other clients (e.g. Present), see
 * `.features/game-audio/requirements.md` US-5.
 */
export interface AudioSettingsMessage {
  type: "audio-settings";
  muted: boolean;
  /** 0..1 */
  volume: number;
}

/**
 * Messages a client may send to the server.
 */
export type InboundMessage = PingBroadcastMessage | AudioSettingsMessage;

/**
 * Messages the server relays to other clients.
 */
export type OutboundMessage = PingBroadcastMessage | AudioSettingsMessage;

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

export function isAudioSettingsMessage(value: unknown): value is AudioSettingsMessage {
  return (
    isRecord(value) &&
    value.type === "audio-settings" &&
    typeof value.muted === "boolean" &&
    typeof value.volume === "number"
  );
}
