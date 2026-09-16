import type { BotState, RouteOption } from "@arena/bot-contract";
import { type Motion, motionFromState } from "./movement";
import {
  absoluteBounds,
  compareIds,
  LANDING_MARGIN,
  type Maneuver,
  type Prediction,
  predict,
  surfaces,
} from "./predictor";

export const SEARCH_LIMITS = Object.freeze({
  coins: 8,
  states: 32,
  depth: 3,
  options: 24,
  integrationSteps: 2048,
  quantumSteps: 256,
});
export interface SearchStats {
  coinTargets: number;
  states: number;
  maxDepth: number;
  integrationSteps: number;
  status: "complete" | "search-budget-exhausted";
}
export interface RouteSearch {
  options: RouteOption[];
  plans: Map<string, Prediction[]>;
  stats: SearchStats;
  resume?: () => RouteSearch;
}

export function planRoutes(state: BotState): RouteSearch {
  // A paused generator owns its observation; callers may reuse/mutate snapshots.
  state = JSON.parse(JSON.stringify(state)) as BotState;
  const start = motionFromState(state);
  const cx = start.body.x + start.body.width / 2;
  const cy = start.body.y + start.body.height / 2;
  const goal = state.navigation!.goalBounds;
  const goalPosition = goal
    ? { x: goal.x + goal.width / 2, y: goal.y + goal.height / 2 }
    : {
        x: state.position.x + state.goalDirection.dx,
        y: state.position.y + state.goalDirection.dy,
      };
  const coins = state.coins
    .filter((c) => c.id && c.bounds)
    .sort((a, b) => {
      const aa = absoluteBounds(state, a.bounds!);
      const bb = absoluteBounds(state, b.bounds!);
      return (
        Math.hypot(aa.x - cx, aa.y - cy) - Math.hypot(bb.x - cx, bb.y - cy) ||
        compareIds(a.id!, b.id!)
      );
    })
    .slice(0, SEARCH_LIMITS.coins);
  const stats: SearchStats = {
    coinTargets: coins.length,
    states: 1,
    maxDepth: 0,
    integrationSteps: 0,
    status: "complete",
  };
  const result: RouteSearch = { options: [], plans: new Map(), stats };
  const geometry = surfaces(state);
  const targets: RouteOption["target"][] = coins.map((c) => {
    const b = absoluteBounds(state, c.bounds!);
    return {
      id: c.id!,
      kind: "coin",
      value: c.value,
      position: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    };
  });
  targets.push({ id: "goal", kind: "goal", value: 0, position: goalPosition });
  interface Node {
    motion: Motion;
    path: Prediction[];
    collected: Set<string>;
    elapsedMs: number;
  }
  const queue: Node[] = [{ motion: start, path: [], collected: new Set(), elapsedMs: 0 }];
  const visited = new Set<string>();
  let exhausted = false;
  const originalDistance = Math.hypot(goalPosition.x - cx, goalPosition.y - cy);

  function offer(node: Node) {
    const last = node.path[node.path.length - 1];
    const x = last.end.body.x + last.end.body.width / 2;
    const y = last.end.body.y + last.end.body.height / 2;
    const progress = originalDistance - Math.hypot(goalPosition.x - x, goalPosition.y - y);
    const fruitValue = coins
      .filter((c) => node.collected.has(c.id!))
      .reduce((sum, c) => sum + c.value, 0);
    for (const target of targets) {
      if (
        target.kind === "coin"
          ? !node.collected.has(target.id)
          : progress < 12 && !node.path.some((p) => p.goalReached)
      )
        continue;
      const routeId = node.path
        .map(
          (p) =>
            `${p.landing!.platformId}@${Math.round(p.maneuver.aimX)}:${p.maneuver.jump ? p.maneuver.holdMs : "walk"}:${p.maneuver.sprint ? "sprint" : "base"}`
        )
        .join(">");
      const id = `${target.kind}:${target.id}/${routeId}`;
      if (result.plans.has(id) || result.options.length >= SEARCH_LIMITS.options) continue;
      result.plans.set(id, node.path);
      const distance = node.path.reduce(
        (sum, p, i) =>
          sum + Math.abs(p.end.body.x - (i ? node.path[i - 1].end.body.x : start.body.x)),
        0
      );
      result.options.push({
        id,
        target: { ...target, position: { ...target.position } },
        route: {
          id: routeId,
          estimatedDurationMs: node.elapsedMs,
          detourPx: Math.max(0, distance - progress),
          expectedFruitValue: fruitValue,
          goalProgressPx: progress,
          risk: node.path.reduce((sum, p) => sum + p.risk, 0),
          landingMarginPx: Math.min(...node.path.map((p) => p.landing!.marginPx)),
          mechanics: [...new Set(node.path.flatMap((p) => p.mechanics))],
          scope:
            target.kind === "coin" || node.path.some((p) => p.goalReached)
              ? "target-reachable"
              : "local-progress",
        },
      });
    }
  }

  function* explore(): Generator<void> {
    while (queue.length && !exhausted) {
      const node = queue.shift()!;
      if (node.path.length >= SEARCH_LIMITS.depth) continue;
      const x = node.motion.body.x + node.motion.body.width / 2;
      const feet = node.motion.body.y + node.motion.body.height;
      const candidates: Maneuver[] = [];
      const keys = new Set<string>();
      function add(aimX: number, jump: boolean, holdMs: number, sprint = false) {
        const key = `${Math.round(aimX)}:${jump}:${holdMs}:${sprint}`;
        if (keys.has(key)) return;
        keys.add(key);
        candidates.push({
          aimX,
          direction: Math.sign(aimX - x) as -1 | 0 | 1,
          jump,
          holdMs,
          sprint,
        });
      }
      const goalDir = Math.sign(goalPosition.x - x) || 1;
      const goalAim = x + goalDir * Math.min(300, Math.abs(goalPosition.x - x));
      // Reserve an early goal candidate so eight fruit detours cannot starve
      // the baseline. A nearby wall also contributes a bounded run-up node.
      add(goalAim, false, 0, true);
      const wall = geometry.find(
        (p) =>
          p.collision === "solid" &&
          p.y < feet &&
          p.y + p.height > node.motion.body.y &&
          (goalDir > 0 ? p.x >= x && p.x - x < 120 : p.x + p.width <= x && x - p.x - p.width < 120)
      );
      if (wall) {
        const edge = goalDir > 0 ? wall.x : wall.x + wall.width;
        if (Math.abs(edge - x) < 70 && node.path.length === 0) add(x - goalDir * 72, false, 0);
        add((goalDir > 0 ? wall.x + wall.width : wall.x) + goalDir * 40, true, 600);
      }
      const overhead = geometry.find(
        (p) =>
          p.collision === "solid" &&
          p.y + p.height <= node.motion.body.y &&
          p.y >= feet - 190 &&
          (goalDir > 0 ? p.x >= x && p.x - x < 120 : p.x + p.width <= x && x - p.x - p.width < 120)
      );
      if (overhead && node.motion.onGround && node.path.length === 0) {
        const support = geometry.find(
          (p) =>
            Math.abs(p.y - feet) <= 1 &&
            node.motion.body.x >= p.x &&
            node.motion.body.x + node.motion.body.width <= p.x + p.width
        );
        if (support) {
          // Leave room for the held control through the next decision boundary,
          // not just for the predictor's first arrival within its aim tolerance.
          const inset =
            node.motion.body.width / 2 +
            LANDING_MARGIN +
            (state.tuning.baseMoveSpeed *
              Math.max(state.tuning.tickMs, state.navigation!.physicsStepMs)) /
              1000;
          const low = support.x + inset;
          const high = support.x + support.width - inset;
          const aim = Math.max(low, Math.min(high, x - goalDir * 72));
          if (low <= high && (x - aim) * goalDir > 3) add(aim, false, 0);
        }
      }
      // Concrete targets, followed by useful intermediate support intervals.
      for (const target of targets) {
        if (target.kind !== "coin" || node.collected.has(target.id)) continue;
        if (Math.abs(target.position.x - x) > 400 || feet - target.position.y > 210) continue;
        const high = target.position.y < node.motion.body.y - 8;
        if (!high) add(target.position.x, false, 0);
        add(target.position.x, true, high ? 600 : 180);
        if (!high) add(target.position.x, true, 600);
      }
      add(goalAim, true, 600, true);
      const nearbyBlock = geometry.some(
        (block) =>
          block.collision === "solid" &&
          block.y < start.body.y + start.body.height &&
          block.y + block.height > start.body.y + start.body.height - 190 &&
          Math.abs(block.x - x) < 200
      );
      for (const p of geometry) {
        const low = p.x + node.motion.body.width / 2 + LANDING_MARGIN;
        const high = p.x + p.width - node.motion.body.width / 2 - LANDING_MARGIN;
        if (low > high || p.y < feet - 190 || p.y > feet + 220) continue;
        const desired =
          targets.find(
            (t) => t.kind === "coin" && !node.collected.has(t.id) && t.position.y < feet - 100
          )?.position.x ?? goalAim;
        const aimX = Math.max(low, Math.min(high, desired));
        if (Math.abs(aimX - x) > 380 || (Math.abs(aimX - x) < 12 && Math.abs(p.y - feet) < 8))
          continue;
        if (p.y >= feet - 8) add(aimX, false, 0);
        add(aimX, true, p.y < feet - 60 ? 600 : 180);
        add(aimX, true, 600, Math.abs(aimX - x) > 280);
        const middle = p.x + p.width / 2;
        if (nearbyBlock && Math.abs(middle - x) <= 380) {
          add(middle, true, 600);
          add(low + (high - low) * 0.25, true, 600);
          add(low + (high - low) * 0.75, true, 600);
          if (p.y < feet - 60) {
            add(low, true, 600, true);
            add(high, true, 600, true);
          }
        }
      }
      // Prefer clearing an overhead obstacle to walking back underneath it after
      // a preparation leg. The navigator replans at each supported boundary.
      if (overhead) candidates.sort((a, b) => b.holdMs - a.holdMs);
      for (const maneuver of candidates) {
        let prediction: Prediction | undefined;
        while (!prediction || prediction.resume) {
          const remaining = SEARCH_LIMITS.quantumSteps - stats.integrationSteps;
          if (remaining <= 0) {
            stats.status = "search-budget-exhausted";
            yield;
            stats.integrationSteps = 0;
          }
          const previousSteps = prediction?.steps ?? 0;
          prediction = prediction?.resume
            ? prediction.resume(SEARCH_LIMITS.quantumSteps - stats.integrationSteps)
            : predict(
                state,
                maneuver,
                SEARCH_LIMITS.quantumSteps - stats.integrationSteps,
                node.motion,
                node.elapsedMs
              );
          stats.integrationSteps += prediction.steps - previousSteps;
        }
        if (!prediction.safe) continue;
        // Landing may precede the next action tick. Do not certify an endpoint
        // whose still-held horizontal control consumes the required margin.
        const support = geometry.find((p) => p.id === prediction.landing!.platformId)!;
        const decisionMs =
          Math.ceil(state.tuning.tickMs / state.navigation!.physicsStepMs) *
          state.navigation!.physicsStepMs;
        const untilDecision =
          Math.ceil((prediction.durationMs - 0.001) / decisionMs) * decisionMs -
          prediction.durationMs;
        const heldSpeed = maneuver.sprint
          ? Math.sign(prediction.end.vx) * state.tuning.sprintMoveSpeed
          : prediction.end.vx;
        const stoppedX = prediction.end.body.x + (heldSpeed * Math.max(0, untilDecision)) / 1000;
        if (
          stoppedX < support.x + LANDING_MARGIN ||
          stoppedX + prediction.end.body.width > support.x + support.width - LANDING_MARGIN
        )
          continue;
        const next: Node = {
          motion: prediction.end,
          path: [...node.path, prediction],
          elapsedMs: node.elapsedMs + prediction.durationMs,
          collected: new Set([...node.collected, ...prediction.collectedIds]),
        };
        stats.maxDepth = Math.max(stats.maxDepth, next.path.length);
        const stillBelowBlock =
          overhead &&
          prediction.end.body.y >= overhead.y + overhead.height &&
          (goalDir > 0
            ? prediction.end.body.x < overhead.x + overhead.width
            : prediction.end.body.x + prediction.end.body.width > overhead.x);
        // An approach back under the same block is a search node, not useful
        // standalone progress: offering it makes landing-boundary replans loop.
        if (!stillBelowBlock || next.collected.size > node.collected.size) offer(next);
        const m = next.motion;
        const key = `${prediction.landing!.platformId}:${Math.round(m.body.x / 16)}:${Math.sign(m.vx)}:${Math.round(m.sprintMs / 100)}:${[...next.collected].sort().join(",")}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (stats.states >= SEARCH_LIMITS.states) {
          exhausted = true;
          break;
        }
        stats.states++;
        queue.push(next);
      }
    }
    stats.status = exhausted ? "search-budget-exhausted" : "complete";
  }
  const search = explore();
  const resume = () => {
    const { done } = search.next();
    result.options.sort((a, b) => compareIds(a.id, b.id));
    result.resume = done ? undefined : resume;
    return result;
  };
  return resume();
}
