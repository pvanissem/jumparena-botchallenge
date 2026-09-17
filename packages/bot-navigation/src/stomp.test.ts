import type { ControlCommand, NavigationIntent } from "@arena/bot-contract";
import { describe, expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { createMovementController } from "./index";
import { movementOptions } from "./options";

function scene(gap = false) {
  const s = fixture();
  s.position = { x: 92, y: 284 };
  s.platforms = gap
    ? [platform("near", -92, 16, 140), platform("far", 176, 16, 320)]
    : [platform("far", -92, 16, 900)];
  s.hazards = [
    {
      id: "frog",
      kind: "ninjafrog",
      dx: gap ? 206 : 120,
      dy: 0,
      bounds: { dx: gap ? 196 : 110, dy: -10, width: 20, height: 26 },
      active: true,
      warning: false,
      stompable: true,
      vx: 60,
      vy: 0,
    },
  ];
  return s;
}
const attack = {
  id: "attack",
  kind: "stomp",
  hazardId: "frog",
  platformId: "far",
  x: 232,
  sprint: true,
  holdMs: 300,
} as ControlCommand;
function tick(s: ReturnType<typeof scene>, x: number, y: number, ground = false) {
  s.tick++;
  s.navigation.observedAtMs += 33;
  s.navigation.body.x = x;
  s.navigation.body.y = y;
  s.onGround = ground;
}
describe("observed stomp attacks", () => {
  it("lets a new attack preference replace a previously blocked avoidance goal", () => {
    const s = scene(true),
      c = createMovementController();
    for (let i = 0; i < 650; i++) {
      s.tick = i;
      s.navigation.observedAtMs = i * 33;
      c.navigate(s, { target: { kind: "goal" } });
    }
    expect(c.status(s).state).toBe("failed");
    s.tick++;
    s.navigation.observedAtMs += 33;
    c.navigate(s, { target: { kind: "goal" }, enemies: "stomp" });
    expect(c.command()).toMatchObject({ kind: "stomp", hazardId: "frog" });
  });
  it.each([false, true])("offers an intentional stomp with a landing, gap=%s", (gap) => {
    const s = scene(gap);
    const options = movementOptions(s, 8, true);
    expect(
      options.some(
        (o) =>
          o.command.kind === "stomp" &&
          o.command.hazardId === "frog" &&
          o.command.platformId === "far"
      )
    ).toBe(true);
    expect(movementOptions(s).some((o) => o.command.kind === "stomp")).toBe(false);
  });
  it("does not offer an attack on an unstompable saw or through a low solid ceiling", () => {
    const s = scene();
    s.hazards[0].kind = "schnetzler";
    s.hazards[0].stompable = false;
    expect(movementOptions(s, 8, true).some((o) => o.command.kind === "stomp")).toBe(false);
    s.hazards[0].kind = "ninjafrog";
    s.hazards[0].stompable = true;
    s.platforms.push(platform("ceiling", -92, -40, 900));
    expect(movementOptions(s, 8, true).some((o) => o.command.kind === "stomp")).toBe(false);
  });
  it("starts a deliberate attack instead of retreating from a reachable moving frog", () => {
    const s = scene(true),
      c = createMovementController();
    const actions = c.navigate(s, {
      target: { kind: "goal" },
      enemies: "stomp",
    } as NavigationIntent);
    expect(c.command()).toMatchObject({ kind: "stomp", hazardId: "frog" });
    expect(actions).toContain("jump");
    expect(actions).not.toContain("sprint-left");
  });
  it("tracks the named moving enemy during flight instead of the fixed landing x", () => {
    const s = scene(),
      c = createMovementController();
    expect(c.run(s, attack)).toContain("jump");
    tick(s, 230, 160);
    s.velocity.vy = 100;
    const bounds = s.hazards[0].bounds;
    if (!bounds) throw new Error("Fixture requires a collider");
    bounds.dx = 80;
    s.hazards[0].vx = -60;
    expect(c.run(s, attack)).toContain("sprint-left");
    tick(s, 180, 170);
    bounds.dx = 160;
    s.hazards[0].vx = 60;
    expect(c.run(s, attack)).toContain("sprint-right");
  });
  it("requires a matching stomp impulse and a subsequent landing to succeed", () => {
    const s = scene(),
      c = createMovementController();
    c.run(s, attack);
    tick(s, 150, 170);
    s.velocity.vy = -100;
    c.status(s);
    s.navigation.lastImpulse = { sequence: 1, kind: "stomp", sourceId: "frog", atMs: 33 };
    s.hazards = [];
    tick(s, 210, 200);
    expect(c.status(s).state).toBe("running");
    expect(c.run(s, attack)).not.toContain("jump");
    tick(s, 220, 268, true);
    s.velocity.vy = 0;
    expect(c.status(s)).toMatchObject({ state: "succeeded", reason: null });
  });
  it("does not cut the ascent before horizontal interception when a frog moves away", () => {
    const s = scene(true),
      c = createMovementController();
    const command = { ...attack, x: 330 };
    expect(c.run(s, command)).toContain("jump");
    tick(s, 130, 190);
    s.velocity.vy = -400;
    c.status(s);
    tick(s, 180, 140);
    s.navigation.observedAtMs = 400;
    s.velocity.vy = -250;
    expect(c.run(s, command)).toContain("jump");
    tick(s, 307, 130);
    s.navigation.observedAtMs = 433;
    expect(c.run(s, command)).not.toContain("jump");
  });
  it("does not treat a vanished enemy or another enemy's impulse as success", () => {
    for (const sourceId of [null, "different-frog"]) {
      const s = scene(),
        c = createMovementController();
      c.run(s, attack);
      tick(s, 150, 170);
      c.status(s);
      if (sourceId) s.navigation.lastImpulse = { sequence: 1, kind: "stomp", sourceId, atMs: 33 };
      s.hazards = [];
      tick(s, 220, 268, true);
      expect(c.status(s)).toMatchObject({ state: "failed", reason: "stomp-missed" });
    }
  });
  it("rejects a changed enemy under the same command ID", () => {
    const s = scene(),
      c = createMovementController();
    c.run(s, attack);
    tick(s, 100, 200);
    expect(() => c.run(s, { ...attack, hazardId: "another" } as ControlCommand)).toThrow(/ID/);
  });
});
