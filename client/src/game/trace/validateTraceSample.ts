// The Vite config bundles this validator in Node; include the TS source rather
// than externalizing a workspace package that Node cannot load directly.
import { ACTIONS } from "../../../../packages/bot-contract/src/state";
import { validateNavigationDiagnostic } from "./navigationDiagnostic";

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const index = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= 0;
const point = (v: unknown, x: string, y: string): boolean =>
  record(v) && finite(v[x]) && finite(v[y]);
const bounds = (v: unknown, x: string, y: string): boolean =>
  record(v) && point(v, x, y) && finite(v.width) && v.width > 0 && finite(v.height) && v.height > 0;
const actions = (v: unknown): boolean => Array.isArray(v) && v.every((a) => ACTIONS.includes(a));

/** v1 stays on the legacy reader; v2 must not persist contradictory evidence. */
export function validateTraceSample(value: unknown, from: number, to: number): boolean {
  if (!record(value)) return false;
  const s = value;
  if (
    !index(s.tick) ||
    s.tick < from ||
    s.tick > to ||
    (s.stateTick !== undefined && s.stateTick !== s.tick) ||
    [s.epoch, s.stateFrame].some((v) => v !== undefined && !index(v)) ||
    !finite(s.timeMs) ||
    !point(s.position, "x", "y") ||
    !point(s.velocity, "vx", "vy") ||
    !point(s.goalDirection, "dx", "dy") ||
    !["left", "right"].includes(s.facing as string) ||
    ![s.onGround, s.isSprinting, s.justRespawned, s.tookDamage].every(
      (v) => typeof v === "boolean"
    ) ||
    !finite(s.sprintRampProgress) ||
    !record(s.gapAhead) ||
    typeof s.gapAhead.present !== "boolean" ||
    (s.gapAhead.distance !== null && !finite(s.gapAhead.distance)) ||
    !Array.isArray(s.nearbyTiles) ||
    !s.nearbyTiles.every(
      (row) =>
        Array.isArray(row) &&
        row.every((tile) =>
          ["empty", "solid", "hazard", "coinBlock", "goal", "unknown"].includes(tile)
        )
    )
  )
    return false;

  for (const key of ["platforms", "coins", "hazards", "utilities"]) {
    const list = s[key];
    if (key === "utilities" && list === undefined) continue;
    if (!Array.isArray(list)) return false;
    for (const object of list) {
      if (
        !record(object) ||
        !point(object, "dx", "dy") ||
        (object.id !== undefined && (typeof object.id !== "string" || !object.id.length)) ||
        (object.bounds !== undefined && !bounds(object.bounds, "dx", "dy"))
      )
        return false;
      if (
        key === "platforms" &&
        (!bounds(object, "dx", "dy") ||
          !["ground", "float", "ceiling", "block"].includes(object.kind as string) ||
          (object.collision !== undefined &&
            !["solid", "one-way-up"].includes(object.collision as string)))
      )
        return false;
      if (key === "coins" && !finite(object.value)) return false;
      if (key === "utilities" && typeof object.kind !== "string") return false;
      if (
        key === "hazards" &&
        (typeof object.kind !== "string" ||
          !point(object, "vx", "vy") ||
          ![object.active, object.warning, object.stompable].every((v) => typeof v === "boolean"))
      )
        return false;
    }
  }
  if (s.navigation !== undefined) {
    const n = s.navigation;
    if (
      !record(n) ||
      n.version !== 1 ||
      n.epoch !== s.epoch ||
      n.frame !== s.stateFrame ||
      !index(n.epoch) ||
      !index(n.frame) ||
      !finite(n.observedAtMs) ||
      !finite(n.physicsStepMs) ||
      n.physicsStepMs <= 0 ||
      !bounds(n.body, "x", "y") ||
      !bounds(n.viewport, "x", "y") ||
      (n.goalBounds !== undefined && !bounds(n.goalBounds, "x", "y")) ||
      !finite(n.boingoJumpVelocity) ||
      !finite(n.stompJumpVelocity) ||
      !record(n.movement)
    )
      return false;
    if (n.lastImpulse !== undefined && n.lastImpulse !== null) {
      const impulse = n.lastImpulse;
      if (
        !record(impulse) ||
        !index(impulse.sequence) ||
        !["jump", "boingo", "stomp"].includes(impulse.kind as string) ||
        !finite(impulse.atMs) ||
        (impulse.sourceId !== null && typeof impulse.sourceId !== "string")
      )
        return false;
    }
    const m = n.movement;
    if (
      !["jump", "boingo", "stomp", "none"].includes(m.impulseKind as string) ||
      (m.jumpStartedAtMs !== null && !finite(m.jumpStartedAtMs)) ||
      (m.impulseAtMs !== null && !finite(m.impulseAtMs)) ||
      (m.sourceId !== null && typeof m.sourceId !== "string")
    )
      return false;
  }
  if (s.decision !== null) {
    const d = s.decision;
    if (
      !record(d) ||
      !index(d.tick) ||
      (d.stateTick ?? d.tick) !== s.tick ||
      d.epoch !== s.epoch ||
      (d.stateFrame !== undefined && d.stateFrame !== s.stateFrame) ||
      !["ok", "runtime-error", "timeout"].includes(d.kind as string) ||
      !actions(d.actions) ||
      (d.kind === "runtime-error" && typeof d.message !== "string") ||
      (d.navigation !== undefined &&
        (d.kind !== "ok" || !validateNavigationDiagnostic(d.navigation)))
    )
      return false;
  }
  return true;
}
