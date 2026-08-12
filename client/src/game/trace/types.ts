import type { Action, HazardKind, TileType } from "@arena/bot-contract";

export type RunResult = "death" | "finished" | "time-limit" | "aborted" | "bot-paused";

export type BotDecisionTrace =
  | { tick: number; kind: "ok"; actions: Action[] }
  | { tick: number; kind: "runtime-error"; actions: []; message: string }
  | { tick: number; kind: "timeout"; actions: [] };

export interface TraceTickSample {
  tick: number;
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
  hazards: Array<{
    dx: number;
    dy: number;
    kind: HazardKind;
    active: boolean;
    warning: boolean;
    stompable: boolean;
    vx: number;
    vy: number;
  }>;
  coins: Array<{ dx: number; dy: number; value: number }>;
  platforms: Array<{
    dx: number;
    dy: number;
    width: number;
    height: number;
    kind: "ground" | "float" | "ceiling" | "block";
  }>;
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
  schemaVersion: 1;
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
