import type {
  Action,
  BotState,
  NavigationBounds,
  RelativeBounds,
  RouteOption,
} from "@arena/bot-contract";
import { advanceMovement, type Motion, motionFromState } from "./movement";

export const LANDING_MARGIN = 8;
/** IDs use locale-independent ordering, avoiding ICU startup in the worker. */
export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export interface Maneuver {
  direction: -1 | 0 | 1;
  sprint: boolean;
  jump: boolean;
  aimX: number;
  holdMs: number;
}
export interface Landing {
  platformId: string;
  marginPx: number;
  crossedFromAbove: boolean;
}
export interface Prediction {
  /** Continues the same trajectory; steps/samples remain cumulative. */
  resume?: (budget: number) => Prediction;
  safe: boolean;
  reason: string;
  end: Motion;
  landing: Landing | null;
  steps: number;
  durationMs: number;
  mechanics: RouteOption["route"]["mechanics"];
  contacts: string[];
  collectedIds: string[];
  goalReached: boolean;
  relevantIds: string[];
  risk: number;
  maneuver: Maneuver;
  samples: Array<{
    atMs: number;
    body: NavigationBounds;
    actions: Action[];
    impulseKind: Motion["impulseKind"];
  }>;
}

export function overlaps(a: NavigationBounds, b: NavigationBounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function absoluteBounds(state: BotState, b: RelativeBounds): NavigationBounds {
  return {
    x: state.position.x + b.dx,
    y: state.position.y + b.dy,
    width: b.width,
    height: b.height,
  };
}

export function surfaces(state: BotState) {
  return state.platforms
    .map((p) => {
      const b = absoluteBounds(state, p.bounds ?? p);
      return {
        ...b,
        id: p.id ?? `surface:${b.x}:${b.y}:${b.width}:${b.height}`,
        collision: p.collision ?? "solid",
      };
    })
    .sort((a, b) => compareIds(a.id, b.id));
}

export function actionsFor(m: Maneuver, body: NavigationBounds, elapsedMs: number): Action[] {
  const remaining = m.aimX - (body.x + body.width / 2);
  const direction = Math.abs(remaining) <= 3 ? 0 : Math.sign(remaining);
  const actions: Action[] =
    direction < 0
      ? [m.sprint ? "sprint-left" : "left"]
      : direction > 0
        ? [m.sprint ? "sprint-right" : "right"]
        : ["idle"];
  if (m.jump && elapsedMs <= m.holdMs) actions.push("jump");
  return actions;
}

/** Bounded semi-implicit forecast. A safe result always has observed support. */
export function predict(
  state: BotState,
  maneuver: Maneuver,
  budget = 2048,
  initial?: Motion,
  offsetMs = 0
): Prediction {
  let motion = initial ? { ...initial, body: { ...initial.body } } : motionFromState(state);
  const n = state.navigation!;
  const dtMs = n.physicsStepMs;
  const result: Prediction = {
    safe: false,
    reason: "no-known-landing",
    end: motion,
    landing: null,
    steps: 0,
    durationMs: 0,
    mechanics: [],
    contacts: [],
    collectedIds: [],
    goalReached: false,
    relevantIds: [],
    risk: 0,
    maneuver,
    samples: [],
  };
  if (!(dtMs > 0 && dtMs <= 100) || !Number.isFinite(dtMs)) {
    result.reason = "invalid-physics-step";
    return result;
  }
  if (
    !Object.values(state.tuning).every(Number.isFinite) ||
    state.tuning.gravity <= 0 ||
    !Number.isFinite(n.boingoJumpVelocity) ||
    !Number.isFinite(n.stompJumpVelocity)
  ) {
    result.reason = "invalid-tuning";
    return result;
  }
  if (state.utilities.some((u) => !u.bounds)) {
    result.reason = "missing-utility-bounds";
    return result;
  }
  const platforms = surfaces(state);
  if (
    motion.onGround &&
    motion.vy >= 0 &&
    !platforms.some(
      (p) =>
        Math.abs(motion.body.y + motion.body.height - p.y) <= 1 &&
        motion.body.x < p.x + p.width &&
        motion.body.x + motion.body.width > p.x
    )
  ) {
    result.reason = "unsupported-start";
    return result;
  }
  const destroyed = new Set<string>();
  const relevant = new Set<string>();
  const collected = new Set<string>();
  const mechanics = new Set<RouteOption["route"]["mechanics"][number]>();
  if (maneuver.jump && motion.onGround) mechanics.add("jump");
  else if (motion.onGround) mechanics.add("walk");
  else if (motion.impulseKind === "boingo" || motion.impulseKind === "stomp")
    mechanics.add(motion.impulseKind);
  else mechanics.add("drop");
  let airborne = !motion.onGround || maneuver.jump;
  const horizonMs = state.utilities.length || motion.impulseKind === "boingo" ? 2400 : 1600;
  const maxSteps = Math.ceil(horizonMs / dtMs);
  let remaining = Math.max(1, Math.floor(budget));
  let heldActions: Action[] = [];
  let nextDecisionAtMs = 0;
  function* integrate(): Generator<void> {
    for (let step = 0; step < maxSteps; step++) {
      if (remaining === 0) {
        result.reason = "search-budget-exhausted";
        result.mechanics = [...mechanics];
        result.collectedIds = [...collected];
        result.relevantIds = [...relevant];
        yield;
        result.reason = "no-known-landing";
      }
      remaining--;
      const elapsed = step * dtMs;
      const before = motion.body;
      if (elapsed + 0.001 >= nextDecisionAtMs) {
        heldActions = actionsFor(maneuver, before, elapsed);
        nextDecisionAtMs += Math.max(dtMs, state.tuning.tickMs);
      }
      const actions = heldActions;
      motion = advanceMovement(
        motion,
        actions,
        state.tuning,
        n.observedAtMs + offsetMs + elapsed,
        dtMs
      );
      motion.vy += (state.tuning.gravity * dtMs) / 1000;
      const dx = (motion.vx * dtMs) / 1000;
      const dy = (motion.vy * dtMs) / 1000;
      motion.body.x += dx;
      let wall = false;
      for (const p of platforms) {
        if (
          p.collision !== "solid" ||
          before.y >= p.y + p.height ||
          before.y + before.height <= p.y
        )
          continue;
        if (dx > 0 && before.x + before.width <= p.x && motion.body.x + before.width > p.x) {
          motion.body.x = p.x - before.width;
          wall = true;
        } else if (dx < 0 && before.x >= p.x + p.width && motion.body.x < p.x + p.width) {
          motion.body.x = p.x + p.width;
          wall = true;
        } else if (overlaps(motion.body, p)) wall = true;
        if (wall) {
          relevant.add(p.id);
          result.contacts.push(`wall:${p.id}`);
          break;
        }
      }
      motion.body.y += dy;
      motion.onGround = false;
      let support: (typeof platforms)[number] | undefined;
      for (const p of platforms) {
        if (motion.body.x >= p.x + p.width || motion.body.x + before.width <= p.x) continue;
        if (
          dy >= 0 &&
          before.y + before.height <= p.y + 0.01 &&
          motion.body.y + before.height >= p.y
        ) {
          if (!support || p.y < support.y) support = p;
        } else if (
          p.collision === "solid" &&
          dy < 0 &&
          before.y >= p.y + p.height - 0.01 &&
          motion.body.y < p.y + p.height
        ) {
          motion.body.y = p.y + p.height;
          motion.vy = 0;
          relevant.add(p.id);
          result.contacts.push(`ceiling:${p.id}`);
        }
      }
      if (support) {
        motion.body.y = support.y - before.height;
        motion.vy = 0;
        motion.onGround = true;
        motion.jumpStartedAtMs = null;
        motion.impulseKind = "none";
        relevant.add(support.id);
      } else {
        if (!airborne && !maneuver.jump) mechanics.add("drop");
        airborne = true;
      }
      // Axis separation alone misses a thin corner crossed in both axes. Reject
      // the conservative swept corridor unless the resolved top/bottom contact
      // explains it. False negatives are preferable to invented safe landings.
      const collisionSweep = {
        x: Math.min(before.x, motion.body.x),
        y: Math.min(before.y, motion.body.y),
        width: before.width + Math.abs(motion.body.x - before.x),
        height: before.height + Math.abs(motion.body.y - before.y),
      };
      for (const p of platforms) {
        if (p.collision !== "solid" || !overlaps(collisionSweep, p)) continue;
        if (support?.id === p.id || (dy < 0 && motion.body.y >= p.y + p.height)) continue;
        if (
          Math.abs(before.y + before.height - p.y) <= 0.01 &&
          (motion.body.x >= p.x + p.width || motion.body.x + before.width <= p.x)
        )
          continue;
        wall = true;
        relevant.add(p.id);
        result.contacts.push(`wall:${p.id}`);
      }

      let danger = false;
      const swept = {
        x: Math.min(before.x, motion.body.x),
        y: Math.min(before.y, motion.body.y),
        width: before.width + Math.abs(motion.body.x - before.x),
        height: before.height + Math.abs(motion.body.y - before.y),
      };
      // RaceScene registers utility overlaps before hazard overlaps. The bounce
      // changes vy immediately, so the same contact cannot then qualify as a stomp.
      for (const utility of state.utilities) {
        if (!utility.bounds) continue;
        const id =
          utility.id ?? `utility:${state.position.x + utility.dx}:${state.position.y + utility.dy}`;
        if (motion.vy > 0 && overlaps(motion.body, absoluteBounds(state, utility.bounds))) {
          motion.vy = n.boingoJumpVelocity;
          motion.onGround = false;
          motion.impulseKind = "boingo";
          motion.jumpStartedAtMs = null;
          mechanics.add("boingo");
          relevant.add(id);
          result.contacts.push(`boingo:${id}`);
          airborne = true;
        }
      }
      for (const hazard of state.hazards) {
        const id =
          hazard.id ??
          `hazard:${hazard.kind}:${state.position.x + hazard.dx}:${state.position.y + hazard.dy}`;
        if (destroyed.has(id)) continue;
        if (!hazard.bounds) {
          danger = true;
          result.reason = "missing-hazard-bounds";
          break;
        }
        const b = absoluteBounds(state, hazard.bounds);
        const seconds = (offsetMs + elapsed + dtMs) / 1000;
        b.x += hazard.vx * seconds;
        b.y += hazard.vy * seconds;
        const hazardSweep = {
          x: b.x - Math.max(0, (hazard.vx * dtMs) / 1000),
          y: b.y - Math.max(0, (hazard.vy * dtMs) / 1000),
          width: b.width + Math.abs((hazard.vx * dtMs) / 1000),
          height: b.height + Math.abs((hazard.vy * dtMs) / 1000),
        };
        if (!overlaps(swept, hazardSweep)) continue;
        relevant.add(id);
        if (!hazard.active && !hazard.warning) {
          result.risk += 0.01;
          continue;
        }
        if (
          hazard.active &&
          hazard.stompable &&
          motion.vy > 0 &&
          before.y + before.height <= b.y + 0.01 &&
          overlaps(motion.body, b)
        ) {
          motion.vy = n.stompJumpVelocity;
          motion.onGround = false;
          motion.impulseKind = "stomp";
          motion.jumpStartedAtMs = null;
          destroyed.add(id);
          mechanics.add("stomp");
          result.contacts.push(`stomp:${id}`);
          airborne = true;
        } else {
          danger = true;
          result.reason = "hazard-contact";
          break;
        }
      }
      for (const coin of state.coins) {
        if (coin.id && coin.bounds && overlaps(motion.body, absoluteBounds(state, coin.bounds)))
          collected.add(coin.id);
      }
      if (n.goalBounds && overlaps(motion.body, n.goalBounds)) result.goalReached = true;
      result.steps++;
      result.durationMs = result.steps * dtMs;
      result.end = motion;
      result.samples.push({
        atMs: result.durationMs,
        body: { ...motion.body },
        actions,
        impulseKind: motion.impulseKind,
      });
      if (danger || wall) {
        if (wall && !danger) result.reason = "wall-contact";
        break;
      }
      if (
        motion.body.y > state.worldBounds.height ||
        motion.body.x < 0 ||
        motion.body.x + motion.body.width > state.worldBounds.width
      )
        break;
      if (support && motion.onGround) {
        const marginPx = Math.min(
          motion.body.x - support.x,
          support.x + support.width - motion.body.x - before.width
        );
        if (airborne && marginPx < LANDING_MARGIN) {
          result.reason = "insufficient-landing-margin";
          break;
        }
        const arrived =
          Math.abs(maneuver.aimX - (motion.body.x + before.width / 2)) <= Math.max(4, Math.abs(dx));
        if (marginPx >= LANDING_MARGIN && (airborne || arrived)) {
          result.landing = { platformId: support.id, marginPx, crossedFromAbove: airborne };
          result.safe = true;
          result.reason = "supported";
          break;
        }
      }
    }
    result.mechanics = [...mechanics];
    result.collectedIds = [...collected];
    result.relevantIds = [...relevant];
    // Relative costs, not probabilities: narrow margins, horizon and moving actors.
    result.risk +=
      (result.landing ? LANDING_MARGIN / result.landing.marginPx : 1) + result.durationMs / 16000;
    result.risk +=
      (state.hazards.filter((h) => h.vx !== 0 || h.vy !== 0).length * result.durationMs) / 16000;
  }
  const iterator = integrate();
  const resume = (quantum: number): Prediction => {
    remaining = Math.max(1, Math.floor(quantum));
    const { done } = iterator.next();
    result.resume = done ? undefined : resume;
    return result;
  };
  return resume(budget);
}
