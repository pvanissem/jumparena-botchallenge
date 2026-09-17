import type {
  BotState,
  ControlCommand,
  MovementOption,
  NavigationBounds,
  RelativeBounds,
} from "@arena/bot-contract";

const intersects = (a: NavigationBounds, b: NavigationBounds, margin = 0) =>
  a.x < b.x + b.width + margin &&
  a.x + a.width > b.x - margin &&
  a.y < b.y + b.height + margin &&
  a.y + a.height > b.y - margin;
const absolute = (s: BotState, b: RelativeBounds) => ({
  x: s.position.x + b.dx,
  y: s.position.y + b.dy,
  width: b.width,
  height: b.height,
});

/** Local, approximate maneuver checks using only the current observation.
 * No level data, search graph or success guarantee; the motor checks actual landing.
 */
export function movementOptions(s: BotState): MovementOption[] {
  if (!s.navigation || !s.onGround || !s.isAlive) return [];
  const n = s.navigation;
  const body = n.body,
    center = body.x + body.width / 2,
    feet = body.y + body.height;
  const direction = Math.sign(s.goalDirection.dx) || 1;
  const platforms = s.platforms.map((p) => ({
    ...absolute(s, p.bounds ?? p),
    id: p.id,
    collision: p.collision,
    kind: p.kind,
  }));
  const observedSupport = platforms.find(
    (p) => Math.abs(p.y - feet) <= 3 && body.x + body.width > p.x && body.x < p.x + p.width
  );
  if (!observedSupport) return [];
  const support = observedSupport;
  const hazards = s.hazards.flatMap((h) =>
    h.bounds && (h.active || h.warning || h.kind === "loderix")
      ? [{ ...absolute(s, h.bounds), vx: h.vx, vy: h.vy, active: h.active || h.warning }]
      : []
  );
  function danger(b: NavigationBounds, time: number, flight = false) {
    // Do not extrapolate a turning enemy indefinitely along its current velocity.
    const horizon = Math.min(time, 0.25);
    return hazards.some(
      (h) =>
        (flight || h.active) &&
        intersects(
          b,
          {
            x: h.x + h.vx * horizon - Math.min(65, Math.abs(h.vx) * time),
            y: h.y + h.vy * horizon - Math.min(45, Math.abs(h.vy) * time),
            width: h.width + 2 * Math.min(65, Math.abs(h.vx) * time),
            height: h.height + 2 * Math.min(45, Math.abs(h.vy) * time),
          },
          8 + Math.min(20, (Math.abs(h.vx) + Math.abs(h.vy)) * horizon * 0.25)
        )
    );
  }
  function walkFruitValue(aim: number) {
    const path = {
      ...body,
      x: Math.min(body.x, aim - body.width / 2),
      width: body.width + Math.abs(aim - center),
    };
    const picked = new Set<string>();
    let value = 0;
    for (const coin of s.coins) {
      if (!coin.id || !coin.bounds || picked.has(coin.id)) continue;
      if (intersects(path, absolute(s, coin.bounds))) {
        picked.add(coin.id);
        value += coin.value;
      }
    }
    return value;
  }
  const result: MovementOption[] = [];
  function add(
    move:
      | Omit<Extract<ControlCommand, { kind: "walk" }>, "id">
      | Omit<Extract<ControlCommand, { kind: "jump" }>, "id">
      | Omit<Extract<ControlCommand, { kind: "drop" }>, "id">
      | Omit<Extract<ControlCommand, { kind: "boingo" }>, "id">,
    time: number,
    fruitValue: number
  ) {
    result.push({
      command: { ...move, id: `option:${n.epoch}:${s.tick}:${result.length}` },
      progress: ((move.x ?? center) - center) * direction,
      fruitValue: move.kind === "walk" ? walkFruitValue(move.x) : fruitValue,
      durationMs: Math.round(time * 1000),
    });
  }
  // Approach obstacles early enough to retain room for a jump; inspect every step.
  let walkX = center;
  for (let distance = 8; distance <= 240; distance += 8) {
    const x = center + direction * distance;
    const b = { ...body, x: x - body.width / 2 };
    if (x - body.width / 2 < support.x + 4 || x + body.width / 2 > support.x + support.width - 4)
      break;
    if (
      danger(b, distance / s.tuning.sprintMoveSpeed) ||
      platforms.some((p) => p !== support && p.collision !== "one-way-up" && intersects(b, p))
    )
      break;
    walkX = x;
  }
  // Stop short of a discovered obstruction rather than at contact distance.
  const available = (walkX - center) * direction;
  const underOverhang = platforms.some(
    (p) =>
      p.collision !== "one-way-up" &&
      p.x < body.x + body.width &&
      p.x + p.width > body.x &&
      p.y + p.height <= body.y + 1 &&
      body.y - p.y - p.height < 50
  );
  let walkDistance =
    available < 240
      ? Math.max(0, available - (underOverhang || available <= 90 ? 8 : 70))
      : available;
  for (const h of s.hazards) {
    if (h.kind !== "loderix" || h.active || !h.bounds || h.dx * direction <= 0) continue;
    const fire = absolute(s, h.bounds);
    if (fire.y > feet || fire.y + fire.height < body.y) continue;
    const before =
      direction > 0 ? fire.x - body.width / 2 - 14 : fire.x + fire.width + body.width / 2 + 14;
    const after =
      direction > 0 ? fire.x + fire.width + body.width / 2 + 14 : fire.x - body.width / 2 - 14;
    const approachDistance = (before - center) * direction;
    if (approachDistance >= 12 && approachDistance < walkDistance)
      add({ kind: "walk", x: before, sprint: true }, approachDistance / 260, 0);
    walkDistance = Math.min(walkDistance, Math.max(0, (after - center) * direction));
  }
  if (walkDistance >= 12)
    add(
      { kind: "walk", x: center + direction * walkDistance, sprint: true },
      walkDistance / 260,
      0
    );

  function flight(
    aim: number,
    targetId: string,
    holdMs: number,
    startX = center,
    startFeet = feet,
    bounce = false,
    runUpMs = 0,
    drop = false
  ) {
    const t = s.tuning,
      dt = 1 / 60;
    let x = startX,
      y = startFeet - body.height;
    let ramp =
      bounce || Math.sign(aim - startX) !== Math.sign(s.velocity.vx) ? 0 : s.sprintRampProgress;
    let vy = bounce
      ? n.boingoJumpVelocity
      : t.baseJumpVelocity + (t.sprintJumpVelocity - t.baseJumpVelocity) * ramp;
    if (drop) vy = 0;
    let launched = runUpMs === 0;
    const picked = new Set<string>();
    let fruitValue = 0;
    for (let frame = 1; frame <= 150; frame++) {
      const elapsed = frame * dt,
        previousFeet = y + body.height;

      const speed =
        t.baseMoveSpeed +
        (t.sprintMoveSpeed - t.baseMoveSpeed) * Math.min(1, ramp + (dt * 1000) / t.sprintRampMs);
      const remaining = aim - x;
      if (Math.abs(remaining) > Math.max(3, (speed * t.tickMs) / 2000)) {
        x += Math.sign(remaining) * speed * dt;
        ramp = Math.min(1, ramp + (dt * 1000) / t.sprintRampMs);
      } else ramp = 0;
      if (
        drop &&
        y === startFeet - body.height &&
        x + body.width / 2 > support.x &&
        x - body.width / 2 < support.x + support.width
      ) {
        const grounded = { x: x - body.width / 2, y, width: body.width, height: body.height };
        if (
          danger(grounded, elapsed) ||
          platforms.some(
            (p) => p !== support && p.collision !== "one-way-up" && intersects(grounded, p)
          )
        )
          return null;
        continue;
      }
      if (elapsed * 1000 <= runUpMs) {
        const grounded = { x: x - body.width / 2, y, width: body.width, height: body.height };
        if (
          grounded.x + body.width <= support.x ||
          grounded.x >= support.x + support.width ||
          danger(grounded, elapsed) ||
          platforms.some(
            (p) => p !== support && p.collision !== "one-way-up" && intersects(grounded, p)
          )
        )
          return null;
        continue;
      }
      if (!launched) {
        vy = t.baseJumpVelocity + (t.sprintJumpVelocity - t.baseJumpVelocity) * ramp;
        launched = true;
      }
      if (!bounce && elapsed * 1000 - runUpMs > Math.max(t.minJumpHoldMs, holdMs) && vy < 0) vy = 0;
      vy += t.gravity * dt;
      y += vy * dt;
      const b = { x: x - body.width / 2, y, width: body.width, height: body.height };
      if (danger(b, elapsed, true)) return null;
      for (const p of platforms) {
        if (!intersects(b, p)) continue;
        if (vy > 0 && previousFeet <= p.y + 1) {
          const fullySupported = b.x >= p.x + 1 && b.x + b.width <= p.x + p.width - 1;
          if (p.id === targetId && fullySupported && Math.abs(x - aim) < 14)
            return { time: elapsed, fruitValue };
          return null;
        }
        if (p.collision !== "one-way-up") return null;
      }
      for (const coin of s.coins) {
        if (!coin.id || picked.has(coin.id)) continue;
        const c = coin.bounds
          ? absolute(s, coin.bounds)
          : {
              x: s.position.x + coin.dx - 10,
              y: s.position.y + coin.dy - 10,
              width: 20,
              height: 20,
            };
        if (intersects(b, c)) {
          picked.add(coin.id);
          fruitValue += coin.value;
        }
      }
      if (y > s.worldBounds.height) return null;
    }
    return null;
  }
  for (const p of platforms) {
    const margin = body.width / 2 + Math.min(10, Math.max(1, (p.width - body.width) / 2));
    if (!p.id || p.width < body.width + 2) continue;
    const low = p.x + margin,
      high = p.x + p.width - margin;
    const targets = new Set([
      low,
      high,
      (low + high) / 2,
      Math.max(low, Math.min(high, center + direction * 220)),
      Math.max(low, Math.min(high, center + direction * 340)),
    ]);
    for (const h of hazards) {
      const after = direction > 0 ? h.x + h.width + margin + 24 : h.x - margin - 24;
      if (after >= low && after <= high) targets.add(after);
    }
    for (const aim of targets) {
      if (Math.abs(aim - center) < 36 || Math.abs(aim - center) > 560) continue;
      if (p.y > feet + 2) {
        const path = flight(aim, p.id, 0, center, feet, false, 0, true);
        if (path)
          add({ kind: "drop", platformId: p.id, x: aim, sprint: true }, path.time, path.fruitValue);
      }
      if (p.kind === "ceiling") continue;
      for (const runUpMs of underOverhang ? [0, 33, 66, 99, 132, 165, 198, 231, 264] : [0]) {
        for (const holdMs of [180, 300, 450, 650]) {
          const path = flight(aim, p.id, holdMs, center, feet, false, runUpMs);
          if (path)
            add(
              {
                kind: "jump",
                platformId: p.id,
                x: aim,
                sprint: true,
                holdMs,
                ...(runUpMs ? { runUpMs } : {}),
              },
              path.time,
              path.fruitValue
            );
        }
      }
      for (const u of s.utilities) {
        if (u.kind !== "boingo" || !u.id || !u.bounds) continue;
        const b = absolute(s, u.bounds),
          ux = b.x + b.width / 2;
        if (
          Math.abs(ux - center) > 100 ||
          Math.abs(b.y - feet) > 40 ||
          ux < support.x ||
          ux > support.x + support.width
        )
          continue;
        const approach = {
          ...body,
          x: Math.min(body.x, ux - body.width / 2),
          width: Math.abs(ux - center) + body.width,
        };
        if (
          danger(approach, 0.25) ||
          platforms.some(
            (q) => q !== support && q.collision !== "one-way-up" && intersects(approach, q)
          )
        )
          continue;
        const path = flight(aim, p.id, 650, ux, b.y, true);
        if (path)
          add(
            { kind: "boingo", utilityId: u.id, platformId: p.id, x: aim, sprint: true },
            path.time + 0.5,
            path.fruitValue
          );
      }
    }
  }
  const forward = result.filter((o) => o.progress > 0);
  if (forward.length) return forward;
  const retreatDistance = underOverhang ? 100 : 48;
  const retreat = Math.max(
    support.x + body.width / 2 + 2,
    Math.min(support.x + support.width - body.width / 2 - 2, center - direction * retreatDistance)
  );
  const retreatPath = {
    ...body,
    x: Math.min(body.x, retreat - body.width / 2),
    width: body.width + Math.abs(retreat - center),
  };
  const retreatBody = { ...body, x: retreat - body.width / 2 };
  if (
    retreatBody.x >= support.x + 2 &&
    retreatBody.x + body.width <= support.x + support.width - 2 &&
    Math.abs(retreat - center) >= 12 &&
    !danger(retreatPath, 0.5) &&
    !platforms.some(
      (p) => p !== support && p.collision !== "one-way-up" && intersects(retreatPath, p)
    )
  ) {
    add(
      { kind: "walk", x: retreat, sprint: false },
      Math.abs(retreat - center) / s.tuning.baseMoveSpeed,
      0
    );
  }
  return result;
}
