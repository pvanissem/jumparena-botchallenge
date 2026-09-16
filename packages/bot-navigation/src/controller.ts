import type {
  Action,
  BotState,
  ControlCommand,
  ControlStatus,
  NavigationBounds,
  RelativeBounds,
} from "@arena/bot-contract";

const idle = (): ControlStatus => ({ commandId: null, state: "idle", phase: null, reason: null });
const overlaps = (a: NavigationBounds, b: NavigationBounds) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
function absolute(s: BotState, b: RelativeBounds): NavigationBounds {
  return { x: s.position.x + b.dx, y: s.position.y + b.dy, width: b.width, height: b.height };
}
function observation(state: BotState) {
  if (state.navigation?.version !== 1) throw Error("Bewegung benötigt navigation.version 1");
  return state.navigation;
}
function target(s: BotState, id: string) {
  const p = s.platforms.find((p) => p.id === id);
  return p ? absolute(s, p.bounds ?? p) : null;
}
function valid(c: ControlCommand) {
  if (
    !c ||
    typeof c.id !== "string" ||
    !c.id.trim() ||
    c.id.length > 80 ||
    !["walk", "jump", "boingo", "drop"].includes(c.kind)
  )
    return false;
  if (c.sprint !== undefined && typeof c.sprint !== "boolean") return false;
  if (
    c.kind === "jump" &&
    c.runUpMs !== undefined &&
    (!Number.isFinite(c.runUpMs) || c.runUpMs < 0 || c.runUpMs > 500)
  )
    return false;
  if (c.kind === "walk") return Number.isFinite(c.x);
  return (
    typeof c.platformId === "string" &&
    c.platformId.length > 0 &&
    c.platformId.length <= 128 &&
    (c.x === undefined || Number.isFinite(c.x)) &&
    (c.kind !== "jump" ||
      c.holdMs === undefined ||
      (Number.isFinite(c.holdMs) && c.holdMs >= 0 && c.holdMs <= 1200)) &&
    (c.kind !== "boingo" ||
      (typeof c.utilityId === "string" && c.utilityId.length > 0 && c.utilityId.length <= 128))
  );
}
interface Active {
  command: ControlCommand;
  startedAt: number;
  startImpulse: number;
  aim: number;
  startedGrounded: boolean;
  airborne: boolean;
  bounced: boolean;
  launchAt: number | null;
  progress: { x: number; y: number; at: number };
}
/** Observation-driven controls. No simulated world, path search or implicit fallback. */
export function createMovementController() {
  let current: Active | null = null;
  let ownedCommand: ControlCommand | null = null;
  let result = idle();
  let epoch: number | null = null;
  let observedTick = -1;
  let motorTick = -1;
  function reset() {
    current = null;
    ownedCommand = null;
    result = idle();
    epoch = null;
    observedTick = -1;
    motorTick = -1;
  }
  function fail(reason: string) {
    result = { ...result, state: "failed", reason };
    return [] as Action[];
  }
  function succeed() {
    result = {
      ...result,
      state: "succeeded",
      phase: current?.command.kind === "walk" ? "approach" : "landing",
      reason: null,
    };
  }
  function observe(s: BotState) {
    const n = observation(s);
    if (epoch !== n.epoch || (s.justRespawned && observedTick !== s.tick)) {
      reset();
      epoch = n.epoch;
    }
    if (s.tick < observedTick) throw Error("Veraltete Beobachtung");
    observedTick = s.tick;
    if (!current || result.state !== "running") return;
    if (!s.isAlive || s.tookDamage) {
      fail("died");
      return;
    }
    const b = n.body,
      now = n.observedAtMs,
      a = current,
      c = a.command;
    const persisted = n.lastImpulse;
    const impulse =
      persisted && persisted.sequence > a.startImpulse
        ? persisted
        : !persisted &&
            n.movement.impulseKind !== "none" &&
            n.movement.impulseAtMs !== null &&
            n.movement.impulseAtMs > a.startedAt
          ? {
              kind: n.movement.impulseKind,
              atMs: n.movement.impulseAtMs,
              sourceId: n.movement.sourceId,
            }
          : null;
    if (impulse?.kind === "jump" && a.launchAt === null) a.launchAt = impulse.atMs;
    if (c.kind === "boingo" && impulse?.kind === "boingo") {
      if (impulse.sourceId !== c.utilityId) {
        fail("wrong-boingo");
        return;
      }
      a.bounced = true;
      result.phase = "flight";
    }
    if (!s.onGround) {
      a.airborne = true;
      if (a.launchAt === null) a.launchAt = now;
      if (c.kind !== "boingo" || a.bounced) result.phase = "flight";
    }
    if (c.kind === "walk") {
      if (Math.abs(b.x + b.width / 2 - a.aim) <= 6 && s.onGround) succeed();
    } else {
      const p = target(s, c.platformId);
      if (!p) {
        fail("target-missing");
        return;
      }
      if ((a.airborne || impulse) && s.onGround && s.velocity.vy >= 0) {
        if (c.kind === "boingo" && !a.bounced) {
          fail("bounce-missed");
          return;
        }
        const supported =
          Math.abs(b.y + b.height - p.y) <= 2 && b.x >= p.x && b.x + b.width <= p.x + p.width;
        if (
          supported &&
          Math.abs(b.x + b.width / 2 - a.aim) <=
            Math.max(12, (s.tuning.sprintMoveSpeed * s.tuning.tickMs) / 1000)
        )
          succeed();
        else fail("wrong-landing");
      }
    }
    if (result.state !== "running") return;
    if (Math.hypot(b.x - a.progress.x, b.y - a.progress.y) >= 8)
      a.progress = { x: b.x, y: b.y, at: now };
    if (now - a.progress.at > 800) fail("stalled");
    if (now - a.startedAt > 8000) fail("deadline");
  }
  function status(s: BotState) {
    observe(s);
    return { ...result };
  }
  function start(s: BotState, command: ControlCommand) {
    const n = observation(s),
      b = n.body;
    result = {
      commandId: typeof command?.id === "string" ? command.id : null,
      state: "running",
      phase: "approach",
      reason: null,
    };
    current = null;
    ownedCommand = command ? { ...command } : null;
    if (!valid(command)) {
      fail("invalid-command");
      return;
    }
    let aim = command.x ?? 0;
    if (command.kind !== "walk") {
      const p = target(s, command.platformId);
      if (!p) {
        fail("target-missing");
        return;
      }
      aim = command.x ?? p.x + p.width / 2;
      const edgeMargin = Math.min(8, Math.max(1, (p.width - b.width) / 2));
      if (aim < p.x + b.width / 2 + edgeMargin || aim > p.x + p.width - b.width / 2 - edgeMargin) {
        fail("target-too-narrow");
        return;
      }
    }
    if (
      command.kind === "boingo" &&
      !s.utilities.some((u) => u.id === command.utilityId && u.kind === "boingo" && u.bounds)
    ) {
      fail("utility-missing");
      return;
    }
    if (!s.isAlive) {
      fail("died");
      return;
    }
    current = {
      command: { ...command },
      aim,
      startedGrounded: s.onGround,
      startedAt: n.observedAtMs,
      startImpulse: n.lastImpulse?.sequence ?? 0,
      airborne: !s.onGround,
      bounced: false,
      launchAt: null,
      progress: { x: b.x, y: b.y, at: n.observedAtMs },
    };
    result.phase = !s.onGround ? "flight" : command.kind === "jump" ? "launch" : "approach";
  }
  function steer(s: BotState, aim: number, sprint = false): Action[] {
    const b = observation(s).body,
      remaining = aim - b.x - b.width / 2;
    // Stop before a held decision interval would oscillate around the target.
    const tolerance = Math.max(3, (Math.abs(s.velocity.vx) * s.tuning.tickMs) / 2000);
    return Math.abs(remaining) <= tolerance
      ? []
      : [remaining < 0 ? (sprint ? "sprint-left" : "left") : sprint ? "sprint-right" : "right"];
  }
  function walk(s: BotState, aim: number, sprint = false): Action[] {
    const n = observation(s),
      b = n.body;
    if (!s.onGround) return fail("not-grounded");
    if (Math.abs(aim - b.x - b.width / 2) <= 6) {
      succeed();
      return [];
    }
    const dir = Math.sign(aim - b.x - b.width / 2);
    const distance =
      ((sprint ? s.tuning.sprintMoveSpeed : s.tuning.baseMoveSpeed) *
        Math.max(33, s.tuning.tickMs)) /
      1000;
    const next = { ...b, x: b.x + dir * distance };
    const surfaces = s.platforms.map((p) => absolute(s, p.bounds ?? p));
    const overlapWidth = (body: NavigationBounds, surface: NavigationBounds) =>
      Math.max(
        0,
        Math.min(body.x + body.width, surface.x + surface.width) - Math.max(body.x, surface.x)
      );
    const supported = surfaces.some((surface) => {
      if (Math.abs(b.y + b.height - surface.y) > 2) return false;
      if (next.x >= surface.x && next.x + next.width <= surface.x + surface.width) return true;
      // A checkpoint may place the body partly over an edge. Moving onto more
      // ground is safe; reducing that support still reports the gap.
      return overlapWidth(b, surface) > 0 && overlapWidth(next, surface) > overlapWidth(b, surface);
    });
    if (!supported) return fail("gap-ahead");
    if (
      s.platforms.some(
        (p) => p.collision !== "one-way-up" && overlaps(next, absolute(s, p.bounds ?? p))
      )
    )
      return fail("blocked");
    if (
      s.hazards.some(
        (h) => (h.active || h.warning) && h.bounds && overlaps(next, absolute(s, h.bounds))
      )
    )
      return fail("danger-ahead");
    return steer(s, aim, sprint);
  }
  function run(s: BotState, command: ControlCommand): Action[] {
    observe(s);
    if (motorTick === s.tick) throw Error("run ist pro Tick nur einmal erlaubt");
    motorTick = s.tick;
    if (ownedCommand && ownedCommand.id === command?.id) {
      const keys = [
        "id",
        "kind",
        "x",
        "sprint",
        "platformId",
        "utilityId",
        "holdMs",
        "runUpMs",
      ] as const;
      if (
        keys.some(
          (key) =>
            !Object.is(
              (ownedCommand as unknown as Record<string, unknown>)[key],
              (command as unknown as Record<string, unknown>)[key]
            )
        )
      )
        throw Error("Für geänderte Parameter eine neue Befehls-ID verwenden");
    } else start(s, command);
    if (!current || result.state !== "running") return [];
    const a = current,
      c = a.command,
      n = observation(s);
    if (c.kind === "walk") return walk(s, a.aim, c.sprint);
    if (c.kind === "boingo" && !a.bounced) {
      const utility = s.utilities.find((u) => u.id === c.utilityId && u.bounds);
      if (!utility?.bounds) return fail("utility-missing");
      const bounds = absolute(s, utility.bounds),
        aim = bounds.x + bounds.width / 2;
      const close = Math.abs(aim - n.body.x - n.body.width / 2) <= 60;
      if (s.onGround && !a.airborne && !close) return walk(s, aim, c.sprint);
      result.phase = "launch";
      const actions = steer(s, aim, c.sprint);
      if (s.onGround || a.launchAt === null || n.observedAtMs - a.launchAt < s.tuning.minJumpHoldMs)
        actions.push("jump");
      return actions;
    }
    const actions = steer(s, a.aim, c.sprint);
    if (c.kind === "jump" && !a.airborne && n.observedAtMs - a.startedAt < (c.runUpMs ?? 0)) {
      result.phase = "approach";
      return actions;
    }
    if (
      c.kind === "jump" &&
      a.startedGrounded &&
      (s.onGround ||
        a.launchAt === null ||
        n.observedAtMs - a.launchAt < (c.holdMs ?? Number.POSITIVE_INFINITY)) &&
      (!a.airborne || s.velocity.vy < 0)
    )
      actions.push("jump");
    return actions;
  }
  return { run, status, reset };
}
