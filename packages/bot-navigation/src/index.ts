import type { Action, BotState, ChooseRoute, RouteOption } from "@arena/bot-contract";
import { planRoutes, type RouteSearch } from "./planner";
import {
  absoluteBounds,
  actionsFor,
  compareIds,
  overlaps,
  type Prediction,
  surfaces,
} from "./predictor";

export type { ChooseRoute, RouteOption, StrategyContext } from "@arena/bot-contract";
export { SEARCH_LIMITS } from "./planner";

export interface NavigationDiagnostic {
  targetId: string | null;
  routeId: string | null;
  planId: string | null;
  phase: "select" | "execute" | "wait" | "recover" | "blocked";
  reason: string;
  relevantObjectIds: string[];
  searchBudgetStatus: "available" | "exhausted" | "pending";
  navigationActions: Action[];
}

interface ActivePlan {
  option: RouteOption;
  path: Prediction[];
  index: number;
  startedAtMs: number;
  airborneSeen: boolean;
  progressAtMs: number;
  progressX: number;
  progressY: number;
  geometryKey: string;
}

/** One instance per worker. No game, wall-clock, DOM or network dependencies. */
export function createNavigator() {
  let epoch: number | null = null;
  let lastTick = -1;
  let lastFrame = -1;
  let serial = 0;
  let active: ActivePlan | null = null;
  let previousTargetId: string | null = null;
  let cache: { key: string; result: RouteSearch; hazardsKey: string } | null = null;
  let blockedKey: string | null = null;
  let blockedUntil = 0;
  let recoverUntil = 0;
  let recoveryPreferred = false;
  let planningStartedAtMs = 0;
  const failures = new Map<string, { attempts: number; lockedUntil: number }>();
  let diagnostic: NavigationDiagnostic;

  function reset() {
    epoch = null;
    lastTick = -1;
    lastFrame = -1;
    active = null;
    previousTargetId = null;
    cache = null;
    blockedKey = null;
    blockedUntil = 0;
    recoverUntil = 0;
    recoveryPreferred = false;
    planningStartedAtMs = 0;
    failures.clear();
    diagnostic = {
      targetId: null,
      routeId: null,
      planId: null,
      phase: "select",
      reason: "reset",
      relevantObjectIds: [],
      searchBudgetStatus: "available",
      navigationActions: [],
    };
  }
  reset();

  function output(
    actions: Action[],
    phase: NavigationDiagnostic["phase"],
    reason: string
  ): Action[] {
    diagnostic.phase = phase;
    diagnostic.reason = reason;
    diagnostic.navigationActions = [...actions];
    return [...actions];
  }

  function fail(now: number, reason: string): Action[] {
    if (active) {
      const key = `${active.geometryKey}/${active.option.target.id}`;
      const failure = failures.get(key) ?? { attempts: 0, lockedUntil: 0 };
      failure.attempts++;
      if (failure.attempts >= 2) failure.lockedUntil = now + 3000;
      failures.set(key, failure);
      // Only bounded recent failures, not a level-sized historical map.
      if (failures.size > 32) failures.delete(failures.keys().next().value!);
    }
    active = null;
    recoverUntil = now + 100;
    recoveryPreferred = true;
    return output(["idle"], "recover", reason);
  }

  function decide(state: BotState, choose?: ChooseRoute): Action[] {
    const n = state.navigation;
    if (n?.version !== 1) throw new Error("navigate benoetigt navigation.version 1");
    if (epoch !== n.epoch || state.justRespawned || !state.isAlive) reset();
    epoch = n.epoch;
    if (state.tick === lastTick)
      throw new Error("navigate darf pro Tick nur einmal aufgerufen werden");
    if (state.tick < lastTick || n.frame < lastFrame)
      throw new Error("navigate: veraltete Observation");
    lastTick = state.tick;
    lastFrame = n.frame;
    if (!state.isAlive) return output(["idle"], "wait", "dead");
    const now = n.observedAtMs;
    const body = n.body;
    if (
      ![now, body.x, body.y, body.width, body.height, state.tuning.gravity, n.physicsStepMs].every(
        Number.isFinite
      ) ||
      body.width <= 0 ||
      body.height <= 0 ||
      n.physicsStepMs <= 0 ||
      n.physicsStepMs > 100
    ) {
      active = null;
      return output(["idle"], "blocked", "invalid-observation");
    }
    const geometry = surfaces(state);
    const geometryKey = JSON.stringify(geometry);
    const key = JSON.stringify([
      geometryKey,
      body,
      state.velocity,
      state.onGround,
      state.sprintRampProgress,
      n.movement,
      n.viewport,
      n.goalBounds,
      state.goalDirection,
      state.tuning,
      state.coins,
      state.utilities,
      n.boingoJumpVelocity,
      n.stompJumpVelocity,
      n.physicsStepMs,
      state.worldBounds,
    ]);

    if (active) {
      const leg = active.path[active.index];
      const elapsed = now - active.startedAtMs;
      for (const contact of leg.contacts) {
        if (!contact.startsWith("stomp:")) continue;
        const id = contact.slice(6);
        const observed =
          n.movement.impulseKind === "stomp" &&
          n.movement.sourceId === id &&
          n.movement.impulseAtMs !== null &&
          n.movement.impulseAtMs >= active.startedAtMs;
        if (!observed && !state.hazards.some((h) => h.id === id && h.active && h.stompable))
          return fail(now, "stomp-invalidated");
      }
      const support = geometry.find((p) => p.id === leg.landing!.platformId);
      const expectedLanding = leg.end.body;
      if (body.width !== expectedLanding.width || body.height !== expectedLanding.height)
        return fail(now, "body-changed");
      if (
        (n.movement.impulseKind === "boingo" || n.movement.impulseKind === "stomp") &&
        n.movement.impulseAtMs !== null &&
        n.movement.impulseAtMs >= active.startedAtMs &&
        !leg.contacts.includes(`${n.movement.impulseKind}:${n.movement.sourceId}`)
      )
        return fail(now, "unexpected-impulse");
      const visibleLanding = overlaps(
        { ...expectedLanding, height: expectedLanding.height + 1 },
        n.viewport
      );
      if (
        (!support && visibleLanding) ||
        (support &&
          (Math.abs(support.y - expectedLanding.y - body.height) > 1 ||
            expectedLanding.x < support.x + 8 ||
            expectedLanding.x + body.width > support.x + support.width - 8))
      ) {
        return fail(now, "support-invalidated");
      }
      const sample =
        leg.samples[
          Math.min(leg.samples.length - 1, Math.max(0, Math.floor(elapsed / n.physicsStepMs)))
        ];
      const nearFuture = leg.samples.filter((s) => s.atMs >= elapsed && s.atMs <= elapsed + 150);
      const corridor = [body, ...nearFuture.map((s) => s.body)];
      if (
        active.geometryKey !== geometryKey &&
        geometry.some((p) => p.collision === "solid" && corridor.some((b) => overlaps(b, p)))
      )
        return fail(now, "corridor-invalidated");
      for (const hazard of state.hazards) {
        if (!hazard.active && !hazard.warning) continue;
        if (!hazard.bounds) return fail(now, "new-danger");
        const b = absoluteBounds(state, hazard.bounds);
        const plannedStomp = hazard.id && leg.contacts.includes(`stomp:${hazard.id}`);
        if (
          plannedStomp &&
          hazard.stompable &&
          state.velocity.vy > 0 &&
          body.y + body.height <= b.y &&
          nearFuture.some((s) => s.impulseKind === "stomp")
        )
          continue;
        if (
          corridor.some((p, i) =>
            overlaps(p, {
              ...b,
              x: b.x + (hazard.vx * i * n.physicsStepMs) / 1000,
              y: b.y + (hazard.vy * i * n.physicsStepMs) / 1000,
            })
          )
        )
          return fail(now, "new-danger");
      }
      if (state.tookDamage) return fail(now, "damage-observed");
      if (!state.onGround) active.airborneSeen = true;
      const progressed = Math.hypot(body.x - active.progressX, body.y - active.progressY) >= 8;
      if (progressed) {
        active.progressAtMs = now;
        active.progressX = body.x;
        active.progressY = body.y;
      }
      if (elapsed > leg.durationMs + 500) return fail(now, "plan-deadline");
      if (now - active.progressAtMs >= 500) return fail(now, "progress-stalled");
      if (sample && Math.hypot(sample.body.x - body.x, sample.body.y - body.y) > 64)
        return fail(now, "corridor-deviation");
      const atLanding =
        state.onGround &&
        state.velocity.vy >= 0 &&
        support &&
        Math.abs(body.y + body.height - support.y) <= 2 &&
        body.x >= support.x + 8 &&
        body.x + body.width <= support.x + support.width - 8;
      const complete =
        atLanding &&
        elapsed > n.physicsStepMs &&
        (active.airborneSeen ||
          (!leg.maneuver.jump && elapsed >= leg.durationMs - n.physicsStepMs));
      if (!complete) {
        const actions = actionsFor(leg.maneuver, body, elapsed);
        return output(
          !state.onGround && state.velocity.vy >= 0 ? actions.filter((a) => a !== "jump") : actions,
          "execute",
          "plan-continued"
        );
      }
      // Intermediate landings are safe strategy/replanning boundaries. Relative
      // prediction coordinates are never fabricated as a new BotState.
      previousTargetId = active.option.target.id;
      active = null;
      cache = null;
    }

    if (now < recoverUntil) return output(["idle"], "recover", "recovery-wait");
    if (blockedKey === key && now < blockedUntil)
      return output(["idle"], "blocked", "blocked-unchanged");
    const observedHazardsKey = JSON.stringify(state.hazards);
    if (blockedKey === key && cache?.key === key && cache.hazardsKey !== observedHazardsKey) {
      // Retry stale negative results only after the cooldown, never a pending search.
      cache = null;
      blockedKey = null;
    }
    if (cache?.key !== key) planningStartedAtMs = now;
    const timedOut = now - planningStartedAtMs >= 500;
    const search =
      cache?.key === key
        ? !timedOut && cache.result.resume
          ? cache.result.resume()
          : cache.result
        : planRoutes(state);
    const hazardsKey = cache?.key === key ? cache.hazardsKey : observedHazardsKey;
    cache = { key, result: search, hazardsKey };
    const hazardsChanged = hazardsKey !== observedHazardsKey;
    diagnostic.searchBudgetStatus =
      search.stats.status === "search-budget-exhausted" ? "exhausted" : "available";
    const options = search.options.filter((option) => {
      // Geometry search survives moving actors. Before exposing a stale route,
      // conservatively recheck its entire swept corridor against the NOW
      // observed actors. Changed stomp actors require a new prediction.
      if (hazardsChanged) {
        let offset = 0;
        let before = body;
        for (const leg of search.plans.get(option.id) ?? []) {
          if (leg.mechanics.includes("stomp")) return false;
          for (const sample of leg.samples) {
            const corridor = {
              x: Math.min(before.x, sample.body.x),
              y: Math.min(before.y, sample.body.y),
              width: body.width + Math.abs(before.x - sample.body.x),
              height: body.height + Math.abs(before.y - sample.body.y),
            };
            for (const hazard of state.hazards) {
              if (!hazard.active && !hazard.warning) continue;
              if (!hazard.bounds) return false;
              const b = absoluteBounds(state, hazard.bounds);
              const seconds = (offset + sample.atMs) / 1000;
              const dt = n.physicsStepMs / 1000;
              b.x += hazard.vx * seconds - Math.max(0, hazard.vx * dt);
              b.y += hazard.vy * seconds - Math.max(0, hazard.vy * dt);
              b.width += Math.abs(hazard.vx * dt);
              b.height += Math.abs(hazard.vy * dt);
              if (overlaps(corridor, b)) return false;
            }
            before = sample.body;
          }
          offset += leg.durationMs;
        }
      }
      const failure = failures.get(`${geometryKey}/${option.target.id}`);
      if (!failure) return true;
      if (failure.lockedUntil && failure.lockedUntil <= now) {
        failures.delete(`${geometryKey}/${option.target.id}`);
        return true;
      }
      return failure.lockedUntil <= now;
    });
    if (!options.length) {
      diagnostic.targetId = null;
      diagnostic.routeId = null;
      diagnostic.planId = null;
      diagnostic.relevantObjectIds = [];
      if (search.resume && !timedOut && state.onGround) {
        diagnostic.searchBudgetStatus = "pending";
        return output(["idle"], "wait", "search-budget-exhausted");
      }
      blockedKey = key;
      blockedUntil = now + 3000;
      return output(
        ["idle"],
        "blocked",
        search.resume && timedOut
          ? "planning-deadline"
          : search.stats.status === "search-budget-exhausted"
            ? "search-budget-exhausted"
            : "no-known-continuation"
      );
    }
    const defaults = [...options].sort(
      (a, b) =>
        Number(b.target.kind === "goal") - Number(a.target.kind === "goal") ||
        b.route.goalProgressPx / Math.max(1, b.route.estimatedDurationMs) / (1 + b.route.risk) -
          a.route.goalProgressPx / Math.max(1, a.route.estimatedDurationMs) / (1 + a.route.risk) ||
        compareIds(a.id, b.id)
    );
    const selectedId =
      !recoveryPreferred && choose
        ? choose(
            {
              timeElapsedMs: state.timeElapsedMs,
              timeRemainingMs: Math.max(0, 90000 - state.timeElapsedMs),
              livesRemaining: state.livesRemaining,
              justRespawned: state.justRespawned,
              previousTargetId,
            },
            options.map((o) => ({
              ...o,
              target: { ...o.target, position: { ...o.target.position } },
              route: { ...o.route, mechanics: [...o.route.mechanics] },
            }))
          )
        : null;
    recoveryPreferred = false;
    const selected = options.find((o) => o.id === selectedId) ?? defaults[0];
    const path = search.plans.get(selected.id)!;
    blockedKey = null;
    active = {
      option: selected,
      path,
      index: 0,
      startedAtMs: now,
      airborneSeen: !state.onGround,
      progressAtMs: now,
      progressX: body.x,
      progressY: body.y,
      geometryKey,
    };
    diagnostic.targetId = selected.target.id;
    diagnostic.routeId = selected.route.id;
    diagnostic.planId = `plan:${epoch}:${++serial}`;
    diagnostic.relevantObjectIds = [...new Set(path.flatMap((p) => p.relevantIds))];
    return output(
      actionsFor(path[0].maneuver, body, 0),
      "execute",
      selectedId !== null && selectedId !== selected.id
        ? "unknown-option-fallback"
        : "route-selected"
    );
  }

  function getDiagnostics(): NavigationDiagnostic {
    // Preserve complete lookup IDs whenever possible; omit rather than invent
    // partial object IDs. Three bytes per UTF-16 unit bounds UTF-8 JSON size.
    const clip = (s: string | null) => (s === null ? null : s.slice(0, 128));
    const result = {
      ...diagnostic,
      targetId: clip(diagnostic.targetId),
      routeId: clip(diagnostic.routeId),
      planId: clip(diagnostic.planId),
      relevantObjectIds: diagnostic.relevantObjectIds.filter((s) => s.length <= 128).slice(0, 32),
      navigationActions: [...diagnostic.navigationActions],
    };
    while (JSON.stringify(result).length * 3 > 1950 && result.relevantObjectIds.length)
      result.relevantObjectIds.pop();
    if (
      diagnostic.relevantObjectIds.length !== result.relevantObjectIds.length ||
      (diagnostic.routeId?.length ?? 0) > 128 ||
      (diagnostic.targetId?.length ?? 0) > 128
    )
      result.reason += ":diagnostic-truncated";
    return result;
  }
  return { decide, getDiagnostics, reset };
}
