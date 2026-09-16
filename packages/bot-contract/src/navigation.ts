import type { DecideResult } from "./state";

/** Absolute world-space rectangle, distinct from legacy position/dx/dy. */
export interface NavigationBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RelativeBounds {
  dx: number;
  dy: number;
  width: number;
  height: number;
}

export interface NavigationObservation {
  version: 1;
  epoch: number;
  frame: number;
  observedAtMs: number;
  physicsStepMs: number;
  body: NavigationBounds;
  movement: {
    jumpStartedAtMs: number | null;
    impulseKind: "jump" | "boingo" | "stomp" | "none";
    impulseAtMs: number | null;
    sourceId: string | null;
  };
  viewport: NavigationBounds;
  goalBounds?: NavigationBounds;
  boingoJumpVelocity: number;
  stompJumpVelocity: number;
}

export interface StrategyContext {
  timeElapsedMs: number;
  timeRemainingMs: number;
  livesRemaining: number;
  justRespawned: boolean;
  previousTargetId: string | null;
}

export interface RouteOption {
  id: string;
  target: {
    id: string;
    kind: "coin" | "goal";
    position: { x: number; y: number };
    value: number;
  };
  route: {
    id: string;
    estimatedDurationMs: number;
    detourPx: number;
    expectedFruitValue: number;
    goalProgressPx: number;
    risk: number;
    landingMarginPx: number;
    mechanics: Array<"walk" | "jump" | "drop" | "boingo" | "stomp">;
    scope: "target-reachable" | "local-progress";
  };
}

export type ChooseRoute = (
  context: StrategyContext,
  options: readonly RouteOption[]
) => string | null;

export interface ToolsApi {
  /** Synchronous, once per decide call; bound to that call's state. */
  readonly navigate: (options?: { choose?: ChooseRoute }) => DecideResult;
}
