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
  /** Most recent actual impulse in this epoch, retained after landing. */
  lastImpulse?: {
    sequence: number;
    kind: "jump" | "boingo" | "stomp";
    atMs: number;
    sourceId: string | null;
  } | null;
  viewport: NavigationBounds;
  goalBounds?: NavigationBounds;
  boingoJumpVelocity: number;
  stompJumpVelocity: number;
}
