import { describe, expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { createNavigator } from "./index";
import { planRoutes } from "./planner";
import { predict } from "./predictor";

function tick(s: ReturnType<typeof fixture>) {
  s.tick++;
  s.navigation!.frame += 2;
  s.navigation!.observedAtMs += 33;
  s.timeElapsedMs += 33;
}

function movingHazard(s: ReturnType<typeof fixture>) {
  const t = s.timeElapsedMs / 1000;
  const x = 900 + 20 * Math.sin(t);
  s.hazards = [
    {
      id: "irrelevant",
      kind: "kugelblitz",
      dx: x - s.position.x,
      dy: 100 - s.position.y,
      bounds: { dx: x - 12 - s.position.x, dy: 88 - s.position.y, width: 24, height: 24 },
      vx: 20 * Math.cos(t),
      vy: 0,
      active: true,
      warning: false,
      stompable: false,
    },
  ];
}

describe("critical core review regressions", () => {
  it("finds and executes a bounded safe retreat before clearing the adjacent wall", () => {
    const s = fixture();
    s.navigation!.body.x = 200;
    s.platforms.push(platform("wall", 230, 200, 50, 100));
    const retreat = predict(s, { direction: -1, sprint: false, jump: false, aimX: 140, holdMs: 0 });
    const jump = predict(
      s,
      { direction: 1, sprint: false, jump: true, aimX: 320, holdMs: 600 },
      2048,
      retreat.end,
      retreat.durationMs
    );
    expect(retreat.safe && jump.safe).toBe(true);
    const routes = planRoutes(s);
    for (let i = 0; i < 16 && routes.resume && !routes.options.length; i++) routes.resume();
    const route = routes.options.find(
      (o) => o.target.kind === "goal" && o.route.goalProgressPx > 50
    );
    expect(route).toBeDefined();
    const path = routes.plans.get(route!.id)!;
    expect(path.length).toBeLessThanOrEqual(3);
    expect(path[0].end.body.x).toBeLessThan(s.navigation!.body.x);
    expect(path.every((p) => p.safe && p.landing!.marginPx >= 8)).toBe(true);
    const nav = createNavigator();
    let actions = nav.decide(s);
    for (let i = 0; i < 15 && actions.includes("idle"); i++) {
      tick(s);
      actions = nav.decide(s);
    }
    expect(actions).toContain("left");
    const chosen =
      routes.options.find((o) => o.route.id === nav.getDiagnostics().routeId) ?? route!;
    const firstLeg = routes.plans.get(chosen.id)![0];
    s.navigation!.body = { ...firstLeg.end.body };
    s.velocity = { vx: firstLeg.end.vx, vy: 0 };
    s.navigation!.observedAtMs += firstLeg.durationMs;
    tick(s);
    actions = nav.decide(s);
    for (let i = 0; i < 15 && actions.includes("idle"); i++) {
      tick(s);
      actions = nav.decide(s);
    }
    expect(actions).toContain("jump");
    expect(actions.some((a) => a === "right" || a === "sprint-right")).toBe(true);
  });

  it("does not invent a retreat into a void or an active hazard", () => {
    for (const trap of ["void", "hazard"]) {
      const s = fixture();
      s.navigation!.body.x = 200;
      s.platforms = [
        platform("floor", trap === "void" ? 190 : 0, 300, 810),
        platform("wall", 230, 0, 50, 300),
      ];
      if (trap === "hazard")
        s.hazards = [
          {
            id: "trap",
            kind: "stachlinger",
            dx: 160,
            dy: 280,
            bounds: { dx: 130, dy: 250, width: 60, height: 50 },
            vx: 0,
            vy: 0,
            active: true,
            warning: false,
            stompable: false,
          },
        ];
      const routes = planRoutes(s);
      for (let i = 0; i < 16 && routes.resume; i++) routes.resume();
      expect(routes.options).toEqual([]);
    }
  });

  it("makes progress with an irrelevant moving actor instead of restarting the search each tick", () => {
    const s = fixture();
    s.navigation!.body.x = 600;
    s.position = { x: 612, y: 284 };
    s.platforms = [platform("floor", 500 - 612, 300 - 284, 600)];
    s.goalDirection = { dx: 950 - 612, dy: 280 - 284 };
    s.coins = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      dx: 250 + i * 8 - 612,
      dy: 280 - 284,
      value: 10,
      bounds: { dx: 240 + i * 8 - 612, dy: 270 - 284, width: 20, height: 20 },
    }));
    const nav = createNavigator();
    let moved = false;
    for (let i = 0; i < 16; i++) {
      movingHazard(s);
      const actions = nav.decide(s);
      if (actions.some((a) => a === "right" || a === "sprint-right")) {
        moved = true;
        break;
      }
      tick(s);
    }
    expect(moved).toBe(true);
  });

  it("keeps the 500ms episode deadline despite continuously changing hazard observations", () => {
    const s = fixture();
    s.platforms = [platform("last", 0, 300, 110)];
    s.navigation!.physicsStepMs = 0.1;
    const nav = createNavigator();
    const phases: string[] = [];
    for (let i = 0; i < 25; i++) {
      movingHazard(s);
      nav.decide(s);
      phases.push(nav.getDiagnostics().phase);
      tick(s);
    }
    expect(phases.slice(16).every((phase) => phase === "blocked")).toBe(true);
    expect(nav.getDiagnostics().reason).toBe("blocked-unchanged");
  });

  it("processes a boingo before an overlapping frog, never certifying a false stomp", () => {
    const s = fixture();
    s.onGround = false;
    s.navigation!.body.y = 160;
    s.velocity.vy = 150;
    const bounds = { dx: 115, dy: 230, width: 36, height: 30 };
    s.utilities = [{ id: "spring", kind: "boingo", dx: 130, dy: 240, bounds }];
    s.hazards = [
      {
        id: "frog",
        kind: "ninjafrog",
        dx: 130,
        dy: 240,
        bounds,
        vx: 0,
        vy: 0,
        active: true,
        warning: false,
        stompable: true,
      },
    ];
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 300, holdMs: 0 });
    expect(p.safe).toBe(false);
    expect(p.contacts).toContain("boingo:spring");
    expect(p.contacts).not.toContain("stomp:frog");
    expect(p.reason).toBe("hazard-contact");
  });

  it("caps the cold and every resumed search quantum at 256 actual integrations", () => {
    const s = fixture();
    s.navigation!.physicsStepMs = 1;
    const routes = planRoutes(s);
    expect(routes.stats.integrationSteps).toBeLessThanOrEqual(256);
    for (let i = 0; i < 15 && routes.resume && !routes.options.length; i++) {
      routes.resume();
      expect(routes.stats.integrationSteps).toBeLessThanOrEqual(256);
    }
    expect(routes.options.some((o) => o.target.kind === "goal")).toBe(true);
  });

  it("resumes inside a long trajectory with identical results, rather than restarting it", () => {
    const s = fixture();
    s.navigation!.physicsStepMs = 1;
    const maneuver = { direction: 1 as const, sprint: false, jump: true, aimX: 300, holdMs: 600 };
    const whole = predict(s, maneuver, 2048);
    let split = predict(s, maneuver, 128);
    expect(split.resume).toBeTypeOf("function");
    let previous = split.steps;
    for (let i = 0; i < 20 && split.resume; i++) {
      split = split.resume(128);
      expect(split.steps - previous).toBeLessThanOrEqual(128);
      expect(split.steps).toBeGreaterThan(previous);
      previous = split.steps;
    }
    expect(split.safe).toBe(true);
    expect(split.end).toEqual(whole.end);
    expect(split.samples).toEqual(whole.samples);
    expect(split.contacts).toEqual(whole.contacts);
  });

  it("revalidates newly dangerous actors before exposing a resumed route to the strategy", () => {
    const s = fixture();
    s.navigation!.physicsStepMs = 1;
    const nav = createNavigator();
    const offered: string[] = [];
    const choose = (_context: unknown, options: readonly { id: string }[]) => {
      offered.push(...options.map((o) => o.id));
      return null;
    };
    nav.decide(s, choose);
    expect(offered).toEqual([]);
    // The suspended candidate originally saw no actor. This changed collider
    // covers every future landing while remaining outside the initial body.
    s.hazards = [
      {
        id: "new-wall",
        kind: "stachlinger",
        dx: 200,
        dy: 200,
        bounds: { dx: 110, dy: -500, width: 1000, height: 1000 },
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    for (let i = 0; i < 18; i++) {
      tick(s);
      expect(nav.decide(s, choose)).toEqual(["idle"]);
    }
    expect(offered).toEqual([]);
    expect(nav.getDiagnostics().phase).toBe("blocked");
  });

  it("retains an immutable observation while an individual candidate is suspended", () => {
    const s = fixture();
    s.navigation!.physicsStepMs = 1;
    const routes = planRoutes(s);
    s.platforms = [];
    s.navigation!.body.x = 10000;
    for (let i = 0; i < 15 && routes.resume && !routes.options.length; i++) routes.resume();
    expect(routes.options.length).toBeGreaterThan(0);
    expect([...routes.plans.values()][0][0].end.body.x).toBeLessThan(1000);
  });

  it("does not offer a cached stomp when its required actor disappeared", () => {
    const s = fixture();
    s.navigation!.physicsStepMs = 2;
    s.coins = [
      {
        id: "bait",
        dx: 200,
        dy: 280,
        value: 10,
        bounds: { dx: 190, dy: 270, width: 20, height: 20 },
      },
    ];
    s.hazards = [
      {
        id: "frog",
        kind: "ninjafrog",
        dx: 200,
        dy: 280,
        bounds: { dx: 185, dy: 270, width: 36, height: 30 },
        vx: 0,
        vy: 0,
        active: true,
        warning: false,
        stompable: true,
      },
    ];
    const routes = planRoutes(s);
    for (let i = 0; i < 15 && routes.resume; i++) routes.resume();
    expect(routes.options.some((o) => o.route.mechanics.includes("stomp"))).toBe(true);
    const nav = createNavigator();
    nav.decide(s);
    expect(nav.getDiagnostics().phase).toBe("wait");
    s.hazards = [];
    const mechanics: string[] = [];
    for (let i = 0; i < 15; i++) {
      tick(s);
      nav.decide(s, (_context, options) => {
        mechanics.push(...options.flatMap((o) => o.route.mechanics));
        return null;
      });
    }
    expect(mechanics).not.toContain("stomp");
  });

  it("invalidates an executing stomp when its actor disappears before contact", () => {
    const s = fixture();
    s.onGround = false;
    s.navigation!.body.y = 160;
    s.velocity.vy = 150;
    s.hazards = [
      {
        id: "frog",
        kind: "ninjafrog",
        dx: 130,
        dy: 240,
        bounds: { dx: 115, dy: 230, width: 36, height: 30 },
        vx: 0,
        vy: 0,
        active: true,
        warning: false,
        stompable: true,
      },
    ];
    const nav = createNavigator();
    nav.decide(
      s,
      (_context, options) => options.find((o) => o.route.mechanics.includes("stomp"))?.id ?? null
    );
    expect(nav.getDiagnostics().phase).toBe("execute");
    s.hazards = [];
    tick(s);
    expect(nav.decide(s)).toEqual(["idle"]);
    expect(nav.getDiagnostics().reason).toBe("stomp-invalidated");
  });
});
