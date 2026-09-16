import type { Action, BotState, NavigationObservation, TileType } from "@arena/bot-contract";

export type RunResult = "death" | "finished" | "time-limit" | "aborted" | "bot-paused";

export interface NavigationDiagnostic {
  targetId: string | null;
  routeId: string | null;
  planId: string | null;
  phase: "select" | "execute" | "wait" | "recover" | "blocked";
  reason: string;
  relevantObjectIds: string[];
  searchBudgetStatus?: "available" | "exhausted" | "pending";
  navigationActions?: Action[];
  actionOverride?: "navigation-output-overridden";
}

export interface TraceDecisionCorrelation {
  /** Worker request ID; stateTick is the scene's observation tick. */
  tick: number;
  stateTick?: number;
  epoch?: number;
  stateFrame?: number;
}

export type BotDecisionTrace = TraceDecisionCorrelation &
  (
    | { kind: "ok"; actions: Action[] }
    | { kind: "runtime-error"; actions: []; message: string }
    | { kind: "timeout"; actions: [] }
  ) & { navigation?: NavigationDiagnostic };

export interface TraceTickSample {
  tick: number;
  stateTick?: number;
  epoch?: number;
  stateFrame?: number;
  navigation?: NavigationObservation;
  timeMs: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  facing: "left" | "right";
  onGround: boolean;
  isSprinting: boolean;
  sprintRampProgress: number;
  gapAhead: { present: boolean; distance: number | null };
  goalDirection: { dx: number; dy: number };
  justRespawned: boolean;
  tookDamage: boolean;
  nearbyTiles: TileType[][];
  hazards: BotState["hazards"];
  coins: BotState["coins"];
  platforms: BotState["platforms"];
  utilities?: BotState["utilities"];
  checkpoints?: BotState["checkpoints"];
  respawnPoint?: BotState["respawnPoint"];
  decision: BotDecisionTrace | null;
}

export interface TraceEvent {
  id: string;
  kind: string;
  observed: true;
  tick: number;
  timeMs: number;
  position: { x: number; y: number };
  details?: Record<string, string | number | boolean | null>;
}

export interface TraceEventInput extends Omit<TraceEvent, "id" | "observed"> {}

export interface TraceFinding {
  kind: "stuck" | "oscillating" | "missed-gap" | "jump-cut-short" | "hazard-not-avoided";
  derived: true;
  severity: "warning" | "critical";
  message: string;
  ticks: number[];
  eventIds: string[];
  metrics?: Record<string, number | string | boolean>;
}

export interface TraceWindow {
  fromTick: number;
  toTick: number;
  reason: string;
  samples: TraceTickSample[];
}

export interface TraceTuning {
  tickMs: number;
  minJumpHoldMs: number;
}

export interface BotRunSummary {
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  maxProgress: number;
  coinsCollected: number;
  fruitScore: number;
  technicalErrors: number;
  deathCause: string | null;
}

export interface BotRunTrace {
  schemaVersion: 1 | 2;
  truncation?: {
    reasons: Array<"byte-limit" | "window-limit">;
    omittedSamples: number;
    omittedEvents: number;
    omittedFindings: number;
  };
  run: {
    levelId: string;
    sessionId: string;
    botRevision: string;
    status: "running" | "completed";
    startedAt: string;
    flushedAt: string;
    endedAt: string | null;
    result: RunResult | null;
    endReason: string | null;
    durationMs: number;
    tuning: TraceTuning;
  };
  summary: BotRunSummary;
  events: TraceEvent[];
  findings: TraceFinding[];
  windows: TraceWindow[];
}

export interface RacerSummaryInput {
  position: { x: number; y: number };
  coinsCollected: number;
  fruitScore: number;
}
