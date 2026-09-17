import type {
  Action,
  BotState,
  ControlCommand,
  ControlStatus,
  MovementOption,
  NavigationIntent,
} from "@arena/bot-contract";
import type { createMovementController } from "./controller";
import { movementOptions } from "./options";

type Motor = ReturnType<typeof createMovementController>;
const signature = (c: ControlCommand) =>
  `${c.kind}:${"hazardId" in c ? c.hazardId : ""}:${"platformId" in c ? c.platformId : ""}:${Math.round((c.x ?? 0) / 24)}:${"holdMs" in c ? c.holdMs : ""}:${"runUpMs" in c ? c.runUpMs : ""}`;
const cell = (x: number, y: number) => `${Math.round(x / 40)}:${Math.round(y / 40)}`;

/** Local goal pursuit. Owns recovery, never knows level layouts or hidden objects. */
export function createNavigator(motor: Motor) {
  let identity = "",
    epoch: number | undefined;
  let command: ControlCommand | null = null;
  let terminal: ControlStatus | null = null;
  let bestDistance = Infinity,
    progressedAt = 0,
    nextChoiceAt = 0;
  let visits = new Map<string, number>();
  let failed = new Map<string, number>();
  let fires = new Map<string, { active: boolean; openedAt: number | null }>();
  let sequence = 0;
  let waitingReason = "observing";
  let emptySince: number | null = null;
  let completed = new Map<string, number>();
  let environment = "",
    blockedEnvironment = "",
    retries = 0;

  function reset() {
    identity = "";
    epoch = undefined;
    command = null;
    terminal = null;
    bestDistance = Infinity;
    progressedAt = 0;
    nextChoiceAt = 0;
    emptySince = null;
    visits = new Map();
    failed = new Map();
    fires = new Map();
    completed = new Map();
    environment = "";
    blockedEnvironment = "";
    retries = 0;
  }
  function finish(reason: string, state: "failed" | "succeeded" = "failed"): Action[] {
    command = null;
    terminal = { commandId: "navigation", state, reason, phase: null };
    blockedEnvironment = environment;
    return [];
  }
  function status(s: BotState): ControlStatus {
    if (terminal) return { ...terminal };
    if (command) {
      const detail = motor.status(s);
      return {
        ...detail,
        state: "running",
        reason:
          detail.state === "failed"
            ? `recovering:${detail.reason}`
            : detail.state === "succeeded"
              ? "choosing-next"
              : detail.reason,
      };
    }
    return {
      commandId: "navigation",
      state: "running",
      phase: "approach",
      reason: waitingReason,
    };
  }
  function navigate(s: BotState, intent: NavigationIntent): Action[] {
    if (
      !intent?.target ||
      !["goal", "coin", "platform"].includes(intent.target.kind) ||
      (intent.target.kind !== "goal" &&
        (typeof intent.target.id !== "string" || !intent.target.id)) ||
      (intent.caution !== undefined && !["normal", "careful"].includes(intent.caution)) ||
      (intent.enemies !== undefined && !["avoid", "stomp"].includes(intent.enemies)) ||
      (intent.movement !== undefined && !["normal", "ground"].includes(intent.movement)) ||
      (intent.allowBoingo !== undefined &&
        typeof intent.allowBoingo !== "boolean" &&
        intent.allowBoingo !== "fallback") ||
      (intent.choose !== undefined && typeof intent.choose !== "function")
    )
      throw Error("Ungültiger Navigationswunsch");
    if (!s.navigation) return finish("observation-missing");
    const now = s.navigation.observedAtMs;
    const key = JSON.stringify([
      intent.target.kind,
      intent.target.kind === "goal" ? null : intent.target.id,
      intent.enemies ?? "avoid",
      intent.movement ?? "normal",
      intent.allowBoingo ?? true,
      intent.caution ?? "normal",
    ]);
    // A new strategic destination applies after the current landing. Do not
    // release horizontal steering halfway through a jump (e.g. fruit collected).
    if (
      epoch === s.navigation.epoch &&
      !s.justRespawned &&
      !s.onGround &&
      command &&
      command.kind !== "walk" &&
      motor.status(s).state === "running"
    )
      return motor.run(s, command);
    if (identity !== key || epoch !== s.navigation.epoch || s.justRespawned) {
      reset();
      motor.reset();
      identity = key;
      epoch = s.navigation.epoch;
      progressedAt = now;
    }
    environment = JSON.stringify(
      s.hazards.map((h) => [
        h.id,
        h.active,
        h.warning,
        Math.round((s.position.x + h.dx) / 64),
        Math.sign(h.vx),
      ])
    );
    if (terminal) {
      if (
        terminal.state !== "failed" ||
        !["navigation-blocked", "no-route"].includes(terminal.reason ?? "") ||
        environment === blockedEnvironment ||
        retries >= 2
      )
        return [];
      retries++;
      terminal = null;
      progressedAt = now;
      emptySince = null;
      nextChoiceAt = 0;
      completed.clear();
      waitingReason = "recovering:environment-changed";
    }
    const target = intent.target;
    const object =
      target.kind === "coin"
        ? s.coins.find((c) => c.id === target.id)
        : target.kind === "platform"
          ? s.platforms.find((p) => p.id === target.id)
          : null;
    if (target.kind !== "goal" && !object) return finish("target-missing");
    const b = s.navigation.body,
      center = b.x + b.width / 2,
      feet = b.y + b.height;
    const tx =
      s.position.x +
      (object?.dx ?? s.goalDirection.dx) +
      (target.kind === "platform" && object && "width" in object ? object.width / 2 : 0);
    const ty = s.position.y + (object?.dy ?? s.goalDirection.dy);
    const distance =
      target.kind === "goal"
        ? Math.abs(tx - center)
        : Math.hypot(tx - center, ty - (b.y + b.height / 2));
    if (distance < bestDistance - 24) {
      bestDistance = distance;
      progressedAt = now;
      completed.clear();
    }
    if (now - progressedAt > 20000) return finish("navigation-blocked");
    for (const h of s.hazards) {
      if (h.kind !== "loderix" || !h.id) continue;
      const previous = fires.get(h.id);
      fires.set(h.id, {
        active: h.active,
        openedAt: h.active ? null : previous?.active ? now : (previous?.openedAt ?? null),
      });
    }
    // Bound the memory to the observed neighbourhood, even during a long custom run.
    if (visits.size > 128) {
      const oldest = visits.keys().next().value;
      if (oldest !== undefined) visits.delete(oldest);
    }
    for (const [id, until] of failed) if (until < now) failed.delete(id);
    for (const id of fires.keys()) if (!s.hazards.some((h) => h.id === id)) fires.delete(id);
    if (s.onGround && command?.kind === "boingo" && intent.allowBoingo === false) {
      command = null;
      motor.reset();
    }
    if (command) {
      const outcome = motor.status(s);
      if (outcome.state === "running") return motor.run(s, command);
      if (outcome.state === "failed") failed.set(signature(command), now + 2500);
      if (outcome.state === "succeeded") {
        const key = signature(command);
        completed.set(key, (completed.get(key) ?? 0) + 1);
      }
      const here = cell(center, feet);
      visits.set(here, (visits.get(here) ?? 0) + 1);
      command = null;
    }
    if (!s.isAlive) return finish("died");
    if (!s.onGround || now < nextChoiceAt) return [];
    if (target.kind === "platform" && object && "width" in object) {
      const bounds = object.bounds ?? object;
      const left = s.position.x + bounds.dx;
      if (
        Math.abs(feet - s.position.y - bounds.dy) <= 3 &&
        b.x >= left &&
        b.x + b.width <= left + bounds.width
      )
        return finish("target-reached", "succeeded");
    }

    let choices = movementOptions(
      s,
      intent.caution === "careful" ? 20 : 8,
      intent.enemies === "stomp"
    ).filter((o) => {
      if ((failed.get(signature(o.command)) ?? 0) > now) return false;
      if ((completed.get(signature(o.command)) ?? 0) >= 2) return false;
      if (intent.allowBoingo === false && o.command.kind === "boingo") return false;
      if (!intent.choose && target.kind === "goal" && o.progress < -200) return false;
      if (o.command.kind !== "walk") return true;
      for (const h of s.hazards) {
        if (h.kind !== "loderix" || !h.bounds) continue;
        const left = s.position.x + h.bounds.dx,
          right = left + h.bounds.width;
        const top = s.position.y + h.bounds.dy;
        if (
          top >= feet ||
          top + h.bounds.height <= b.y ||
          Math.max(center, o.command.x) + b.width / 2 <= left ||
          Math.min(center, o.command.x) - b.width / 2 >= right
        )
          continue;
        const opened = h.id ? fires.get(h.id)?.openedAt : null;
        if (h.active || opened == null || now - opened > 200) return false;
      }
      return true;
    });
    if (
      intent.allowBoingo === "fallback" &&
      choices.some((o) => o.command.kind !== "boingo" && o.progress > 0)
    ) {
      choices = choices.filter((o) => o.command.kind !== "boingo");
    }
    const score = (o: MovementOption) => {
      const c = o.command;
      const p = c.kind === "walk" ? null : s.platforms.find((p) => p.id === c.platformId);
      const x = c.x ?? center,
        y = p ? s.position.y + p.dy : feet;
      const remaining =
        target.kind === "goal" ? Math.abs(tx - x) : Math.hypot(tx - x, ty - y + b.height / 2);
      const progress = (distance - remaining) / 400;
      const repetitions = visits.get(cell(x, y)) ?? 0;
      const caution = intent.caution === "careful" ? 1 : 0;
      return (
        (c.kind === "stomp" && o.progress > 0 ? 2 : 0) +
        (intent.movement === "ground" && c.kind === "walk" && o.progress > 0
          ? 0.75 * Math.min(1, o.progress / 240)
          : 0) +
        progress -
        o.durationMs / 15000 -
        repetitions * 0.9 -
        (c.kind === "walk" ? 0 : 0.06 + caution * 0.03)
      );
    };
    choices.sort((a, b) => score(b) - score(a));
    let chosen: MovementOption | undefined = choices[0];
    if (intent.choose) {
      const offered = Object.freeze(
        choices.map((o) => {
          const c = o.command;
          const p = c.kind === "walk" ? undefined : s.platforms.find((p) => p.id === c.platformId);
          const x = c.x ?? center;
          return Object.freeze({
            id: c.id,
            kind: c.kind,
            platformId: p?.id ?? null,
            progress: o.progress,
            distance: Math.abs(x - center),
            rise: p ? feet - (s.position.y + (p.bounds ?? p).dy) : 0,
            durationMs: o.durationMs,
            fruitValue: o.fruitValue,
            crossesEnemy: s.hazards.some(
              (h) =>
                (h.stompable || Math.abs(h.vx) + Math.abs(h.vy) > 0) &&
                Math.abs(h.dy) < 80 &&
                s.position.x + h.dx > Math.min(center, x) &&
                s.position.x + h.dx < Math.max(center, x)
            ),
            ...(c.kind === "stomp" ? { hazardId: c.hazardId } : {}),
          });
        })
      );
      const selected = intent.choose(offered);
      if (selected === null && choices.length > 0) {
        progressedAt = now;
        waitingReason = "strategy-wait";
        return [];
      }
      chosen = choices.find((o) => o.command.id === selected);
      if (!chosen && selected !== null)
        throw Error("Ungültige Bewegungsauswahl: ID muss aus der aktuellen Auswahl stammen");
    }
    const fixedObstructionNear = s.hazards.some(
      (h) => h.kind === "stachlinger" && Math.abs(h.dx) < 80 && Math.abs(h.dy) < 50
    );
    const threatened = s.hazards.some(
      (h) =>
        (h.active || h.warning) && h.dx * h.vx < 0 && Math.abs(h.dx) < 100 && Math.abs(h.dy) < 60
    );
    if (
      !intent.choose &&
      !threatened &&
      !fixedObstructionNear &&
      target.kind === "goal" &&
      chosen &&
      chosen.progress < 0 &&
      s.hazards.some(
        (h) =>
          h.bounds &&
          (h.active || h.warning || h.kind === "loderix") &&
          (h.kind === "loderix" || Math.abs(h.vx) + Math.abs(h.vy) > 0) &&
          h.dx * Math.sign(s.goalDirection.dx) > 0 &&
          Math.abs(h.dx) < (h.kind === "loderix" ? 120 : 400) &&
          Math.abs(h.dy) < 60
      )
    ) {
      chosen = undefined;
    }
    if (!chosen) {
      emptySince ??= now;
      const changing = s.hazards.some(
        (h) => h.kind === "loderix" || Math.abs(h.vx) + Math.abs(h.vy) > 0
      );
      if (!changing && now - emptySince >= 3000) return finish("no-route");
      nextChoiceAt = now + 100;
      waitingReason = changing ? "waiting-for-opening" : "no-movement-option";
      return [];
    }
    emptySince = null;
    command = { ...chosen.command, id: `navigation:${++sequence}` };
    waitingReason = "approach";
    return motor.run(s, command);
  }
  return { navigate, status, reset, command: () => command };
}
