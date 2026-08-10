import {
  type InboundMessage,
  isAudioSettingsMessage,
  isBotAddMessage,
  isBotRemoveMessage,
  isMatchProgressMessage,
  isMatchResultMessage,
  isMatchStartMessage,
  isPingBroadcastMessage,
  isTournamentConfigureMessage,
  isTournamentResetMessage,
} from "@arena/shared";

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

  if (isAudioSettingsMessage(candidate)) {
    return candidate;
  }

  if (isBotAddMessage(candidate)) {
    return candidate;
  }

  if (isBotRemoveMessage(candidate)) {
    return candidate;
  }

  if (isTournamentConfigureMessage(candidate)) {
    return candidate;
  }

  if (isMatchStartMessage(candidate)) {
    return candidate;
  }

  if (isTournamentResetMessage(candidate)) {
    return candidate;
  }

  if (isMatchResultMessage(candidate)) {
    return candidate;
  }

  if (isMatchProgressMessage(candidate)) {
    return candidate;
  }

  return null;
}
