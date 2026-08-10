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

/** Vollständiges Registry-Artefakt inkl. Quelltext (nicht nur Metadaten -
 *  `/present` braucht den Quelltext später zum Ausführen). */
export interface BotArtifact {
  id: string;
  name: string;
  author: string;
  color: string;
  sourceCode: string;
  uploadedAt: string;
}

/** Was der Uploader liefert: Quelltext + die von ihm ausgelesenen Metadaten.
 *  id/color/uploadedAt vergibt der Server (Autorität über Eintrags-Identität). */
export interface BotAddMessage {
  type: "bot-add";
  name: string;
  author: string;
  /** Vom Bot-Modul gesetzte Farbe; fehlt sie, vergibt der Server eine. */
  color?: string;
  sourceCode: string;
}

export interface BotRemoveMessage {
  type: "bot-remove";
  id: string;
}

/** Server -> ALLE Clients (inkl. Sender). */
export interface BotAddedMessage {
  type: "bot-added";
  bot: BotArtifact;
}

/** Server -> ALLE Clients (inkl. Sender). */
export interface BotRemovedMessage {
  type: "bot-removed";
  id: string;
}

/** Server -> NUR den gerade neu verbundenen Client. */
export interface BotRegistrySnapshotMessage {
  type: "bot-registry-snapshot";
  bots: BotArtifact[];
}

export const MAX_BOT_SOURCE_BYTES = 200_000;

/* -------------------------------------------------------------------------- */
/* Turnier & Match-Ausführung                                                 */
/* -------------------------------------------------------------------------- */

import type {
  MatchDef,
  MatchParticipant,
  MatchResult,
  MatchResultEntry,
  TournamentMode,
  TournamentState,
} from "./tournament";

/** /admin -> Server: Turnier konfigurieren und Bracket erzeugen. */
export interface TournamentConfigureMessage {
  type: "tournament-configure";
  mode: TournamentMode;
  levelId: string;
  botIds: string[];
  /** Leben pro Racer. Fehlt der Wert, nutzt der Server
   *  `DEFAULT_LIVES_PER_RUN` (Rückwärtskompatibilität). Die Bereichsprüfung
   *  macht bewusst der `TournamentService`, nicht der Typguard – siehe
   *  `.features/tournament-lives/design.md`. */
  livesPerRun?: number;
}

/** /admin -> Server: Ein konkretes Match starten. */
export interface MatchStartMessage {
  type: "match-start";
  matchId: string;
}

/** /admin -> Server: Turnier abbrechen/zurücksetzen. */
export interface TournamentResetMessage {
  type: "tournament-reset";
}

/** /present -> Server: Ergebnis eines beendeten Matches. */
export interface MatchResultMessage {
  type: "match-result";
  matchId: string;
  result: MatchResult;
}

/** /present -> Server: Live-Zwischenstand eines laufenden Matches. */
export interface MatchProgressMessage {
  type: "match-progress";
  matchId: string;
  entries: {
    botId: string;
    fruitScore: number;
    livesRemaining: number;
    timeElapsedMs: number;
    progress: number;
    finished: boolean;
    didNotFinish: boolean;
    disabled: boolean;
  }[];
}

/** Server -> alle Clients (Snapshot + Live-Update). */
export interface TournamentStateMessage {
  type: "tournament-state";
  state: TournamentState | null;
}

/**
 * Messages a client may send to the server.
 */
export type InboundMessage =
  | PingBroadcastMessage
  | AudioSettingsMessage
  | BotAddMessage
  | BotRemoveMessage
  | TournamentConfigureMessage
  | MatchStartMessage
  | TournamentResetMessage
  | MatchResultMessage
  | MatchProgressMessage;

/**
 * Messages the server relays to other clients.
 */
export type OutboundMessage =
  | PingBroadcastMessage
  | AudioSettingsMessage
  | BotAddedMessage
  | BotRemovedMessage
  | BotRegistrySnapshotMessage
  | TournamentStateMessage
  | MatchProgressMessage;

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

function isBotArtifact(value: unknown): value is BotArtifact {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.author === "string" &&
    typeof value.color === "string" &&
    typeof value.sourceCode === "string" &&
    typeof value.uploadedAt === "string"
  );
}

export function isBotAddMessage(value: unknown): value is BotAddMessage {
  return (
    isRecord(value) &&
    value.type === "bot-add" &&
    typeof value.name === "string" &&
    typeof value.author === "string" &&
    typeof value.sourceCode === "string" &&
    (value.color === undefined || typeof value.color === "string")
  );
}

export function isBotRemoveMessage(value: unknown): value is BotRemoveMessage {
  return isRecord(value) && value.type === "bot-remove" && typeof value.id === "string";
}

export function isBotAddedMessage(value: unknown): value is BotAddedMessage {
  return isRecord(value) && value.type === "bot-added" && isBotArtifact(value.bot);
}

export function isBotRemovedMessage(value: unknown): value is BotRemovedMessage {
  return isRecord(value) && value.type === "bot-removed" && typeof value.id === "string";
}

export function isBotRegistrySnapshotMessage(value: unknown): value is BotRegistrySnapshotMessage {
  return (
    isRecord(value) &&
    value.type === "bot-registry-snapshot" &&
    Array.isArray(value.bots) &&
    value.bots.every(isBotArtifact)
  );
}

function isMatchParticipant(value: unknown): value is MatchParticipant {
  return (
    isRecord(value) &&
    typeof value.botId === "string" &&
    typeof value.name === "string" &&
    typeof value.author === "string" &&
    typeof value.color === "string"
  );
}

function isMatchDef(value: unknown): value is MatchDef {
  if (!isRecord(value)) return false;
  const status = value.status;
  if (status !== "pending" && status !== "running" && status !== "finished") return false;
  return (
    typeof value.id === "string" &&
    Array.isArray(value.participants) &&
    value.participants.every(isMatchParticipant) &&
    (value.result === null || isMatchResult(value.result))
  );
}

function isMatchResultEntry(value: unknown): value is MatchResultEntry {
  return (
    isRecord(value) &&
    typeof value.botId === "string" &&
    typeof value.rank === "number" &&
    typeof value.score === "number" &&
    typeof value.fruitScore === "number" &&
    typeof value.coinsCollected === "number" &&
    typeof value.deaths === "number" &&
    typeof value.timeElapsedMs === "number" &&
    typeof value.reachedGoal === "boolean" &&
    typeof value.disabled === "boolean"
  );
}

function isMatchResult(value: unknown): value is MatchResult {
  return isRecord(value) && Array.isArray(value.entries) && value.entries.every(isMatchResultEntry);
}

function isTournamentState(value: unknown): value is TournamentState {
  if (!isRecord(value)) return false;
  const status = value.status;
  if (status !== "idle" && status !== "running" && status !== "finished") return false;
  return (
    value.mode === "single-elimination" &&
    typeof value.levelId === "string" &&
    typeof value.livesPerRun === "number" &&
    Array.isArray(value.rounds) &&
    value.rounds.every((round: unknown) => Array.isArray(round) && round.every(isMatchDef)) &&
    (value.championBotId === null || typeof value.championBotId === "string")
  );
}

export function isTournamentConfigureMessage(value: unknown): value is TournamentConfigureMessage {
  return (
    isRecord(value) &&
    value.type === "tournament-configure" &&
    value.mode === "single-elimination" &&
    typeof value.levelId === "string" &&
    Array.isArray(value.botIds) &&
    value.botIds.every((id: unknown) => typeof id === "string") &&
    (value.livesPerRun === undefined || typeof value.livesPerRun === "number")
  );
}

export function isMatchStartMessage(value: unknown): value is MatchStartMessage {
  return isRecord(value) && value.type === "match-start" && typeof value.matchId === "string";
}

export function isTournamentResetMessage(value: unknown): value is TournamentResetMessage {
  return isRecord(value) && value.type === "tournament-reset";
}

export function isMatchResultMessage(value: unknown): value is MatchResultMessage {
  return (
    isRecord(value) &&
    value.type === "match-result" &&
    typeof value.matchId === "string" &&
    isMatchResult(value.result)
  );
}

function isMatchProgressEntry(value: unknown): value is MatchProgressMessage["entries"][number] {
  return (
    isRecord(value) &&
    typeof value.botId === "string" &&
    typeof value.fruitScore === "number" &&
    typeof value.livesRemaining === "number" &&
    typeof value.timeElapsedMs === "number" &&
    typeof value.progress === "number" &&
    typeof value.finished === "boolean" &&
    typeof value.didNotFinish === "boolean" &&
    typeof value.disabled === "boolean"
  );
}

export function isMatchProgressMessage(value: unknown): value is MatchProgressMessage {
  return (
    isRecord(value) &&
    value.type === "match-progress" &&
    typeof value.matchId === "string" &&
    Array.isArray(value.entries) &&
    value.entries.every(isMatchProgressEntry)
  );
}

export function isTournamentStateMessage(value: unknown): value is TournamentStateMessage {
  return (
    isRecord(value) &&
    value.type === "tournament-state" &&
    (value.state === null || isTournamentState(value.state))
  );
}
