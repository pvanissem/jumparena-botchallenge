import type {
  Action,
  BotState,
  BotTuning,
  NavigationBounds,
  NavigationObservation,
} from "@arena/bot-contract";

export interface Motion {
  body: NavigationBounds;
  vx: number;
  vy: number;
  onGround: boolean;
  sprintMs: number;
  direction: number;
  jumpStartedAtMs: number | null;
  impulseKind: NavigationObservation["movement"]["impulseKind"];
}

export function motionFromState(state: BotState): Motion {
  const n = state.navigation;
  if (n?.version !== 1) throw new Error("navigate benoetigt navigation.version 1");
  return {
    body: { ...n.body },
    vx: state.velocity.vx,
    vy: state.velocity.vy,
    onGround: state.onGround,
    sprintMs: state.isSprinting ? state.sprintRampProgress * state.tuning.sprintRampMs : 0,
    direction: Math.sign(state.velocity.vx),
    jumpStartedAtMs: n.movement.impulseKind === "jump" ? n.movement.jumpStartedAtMs : null,
    impulseKind: n.movement.impulseKind,
  };
}

/** Same linear ramp/cut semantics as the arena, with contract tuning only. */
export function advanceMovement(
  m: Motion,
  actions: readonly Action[],
  t: BotTuning,
  now: number,
  dtMs: number
): Motion {
  let direction = 0;
  let sprint = false;
  for (const action of actions) {
    if (action === "jump" || action === "idle") continue;
    direction =
      action === "left" || action === "sprint-left"
        ? -1
        : action === "right" || action === "sprint-right"
          ? 1
          : 0;
    sprint = action === "sprint-left" || action === "sprint-right";
  }
  const sprintMs = sprint && direction ? (direction === m.direction ? m.sprintMs : 0) + dtMs : 0;
  const ramp = t.sprintRampMs > 0 ? Math.min(1, sprintMs / t.sprintRampMs) : Number(sprint);
  const vx = direction * (t.baseMoveSpeed + (t.sprintMoveSpeed - t.baseMoveSpeed) * ramp);
  const result = { ...m, body: { ...m.body }, vx, sprintMs, direction };
  if ((m.impulseKind === "boingo" || m.impulseKind === "stomp") && m.vy < 0) {
    result.jumpStartedAtMs = null;
    result.onGround = false;
    return result;
  }
  if (m.onGround) {
    result.jumpStartedAtMs = null;
    if (actions.includes("jump")) {
      const range = t.sprintMoveSpeed - t.baseMoveSpeed;
      const factor =
        range > 0 ? Math.max(0, Math.min(1, (Math.abs(vx) - t.baseMoveSpeed) / range)) : 0;
      result.vy = t.baseJumpVelocity + (t.sprintJumpVelocity - t.baseJumpVelocity) * factor;
      result.jumpStartedAtMs = now;
      result.impulseKind = "jump";
      result.onGround = false;
    }
  } else if (
    m.impulseKind === "jump" &&
    m.jumpStartedAtMs !== null &&
    m.vy < 0 &&
    !actions.includes("jump") &&
    now - m.jumpStartedAtMs >= t.minJumpHoldMs
  ) {
    result.vy = 0;
  }
  return result;
}
