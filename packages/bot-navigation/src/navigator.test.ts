import type { BotState, ChooseRoute, RouteOption } from "@arena/bot-contract";
import { describe, expect, it, vi } from "vitest";
import { fixture, platform } from "./fixtures";
import { createNavigator } from "./index";

const next = (s: BotState, ms = 33) => {
  s.tick++;
  s.timeElapsedMs += ms;
  s.navigation!.frame += Math.round(ms / s.navigation!.physicsStepMs);
  s.navigation!.observedAtMs += ms;
};
const chooseFruit: ChooseRoute = (_context, options) =>
  options.find((o) => o.target.kind === "coin")?.id ?? null;
const addFruit = (s: BotState) => {
  s.coins = [
    {
      id: "apple",
      dx: 240,
      dy: 150,
      value: 10,
      bounds: { dx: 230, dy: 140, width: 20, height: 20 },
    },
  ];
};

describe("navigator motor ownership and lifecycle", () => {
  it("exposes the worker factory API and raw standard actions", () => {
    const nav = createNavigator();
    expect(nav.decide(fixture()).some((a) => a === "right" || a === "sprint-right")).toBe(true);
    expect(nav.getDiagnostics().phase).toBe("execute");
    expect(nav.reset).toBeTypeOf("function");
  });

  it("explains a missing or unsupported navigation observation", () => {
    const s = fixture();
    delete s.navigation;
    expect(() => createNavigator().decide(s)).toThrow("navigation.version 1");
  });

  it("does not share plans across instances", () => {
    const a = createNavigator();
    const b = createNavigator();
    const s = fixture();
    addFruit(s);
    a.decide(s, chooseFruit);
    b.decide(s);
    expect(a.getDiagnostics().targetId).toBe("apple");
    expect(b.getDiagnostics().targetId).toBe("goal");
  });

  it("does not invoke a competing strategy during an owned jump", () => {
    const s = fixture();
    addFruit(s);
    const nav = createNavigator();
    expect(nav.decide(s, chooseFruit)).toContain("jump");
    const id = nav.getDiagnostics().planId;
    next(s);
    s.onGround = false;
    s.navigation!.body.x += 7;
    s.navigation!.body.y -= 18;
    s.velocity = { vx: 200, vy: -530 };
    const competitor = vi.fn(() => null);
    expect(nav.decide(s, competitor)).toContain("jump");
    expect(competitor).not.toHaveBeenCalled();
    expect(nav.getDiagnostics().planId).toBe(id);
  });

  it("keeps a fruit ID when the fruit leaves sight without claiming collection", () => {
    const s = fixture();
    addFruit(s);
    const nav = createNavigator();
    nav.decide(s, chooseFruit);
    next(s);
    s.coins = [];
    s.onGround = false;
    s.navigation!.body.y -= 18;
    s.navigation!.body.x += 7;
    s.velocity.vy = -530;
    nav.decide(s);
    expect(nav.getDiagnostics().targetId).toBe("apple");
    expect(nav.getDiagnostics().reason).toBe("plan-continued");
  });

  it.each(["epoch", "respawn", "death", "reset"])("invalidates plans on %s", (change) => {
    const s = fixture();
    addFruit(s);
    const nav = createNavigator();
    nav.decide(s, chooseFruit);
    const old = nav.getDiagnostics().planId;
    next(s);
    if (change === "epoch") s.navigation!.epoch++;
    if (change === "respawn") s.justRespawned = true;
    if (change === "death") s.isAlive = false;
    if (change === "reset") nav.reset();
    nav.decide(s);
    expect(nav.getDiagnostics().planId).not.toBe(old);
    if (change === "death") expect(nav.getDiagnostics().reason).toBe("dead");
  });

  it("rejects duplicate and stale observations without advancing a plan", () => {
    const nav = createNavigator();
    const s = fixture();
    nav.decide(s);
    expect(() => nav.decide(s)).toThrow("einmal");
    s.tick--;
    expect(() => nav.decide(s)).toThrow("veraltet");
  });

  it("copies strategy options/context and propagates strategy exceptions", () => {
    const nav = createNavigator();
    const s = fixture();
    nav.decide(s, (context, options) => {
      expect(context.timeRemainingMs).toBe(90000);
      expect(context.previousTargetId).toBeNull();
      const id = options[0].id;
      context.previousTargetId = "tampered";
      (options as RouteOption[])[0].target.id = "tampered";
      return id;
    });
    expect(nav.getDiagnostics().targetId).not.toBe("tampered");
    const other = createNavigator();
    expect(() =>
      other.decide(s, () => {
        throw new Error("visitor-error");
      })
    ).toThrow("visitor-error");
  });

  it("uses the same default for null and an unknown option ID, with a hint", () => {
    const a = createNavigator();
    const b = createNavigator();
    expect(a.decide(fixture(), () => null)).toEqual(b.decide(fixture(), () => "not-an-option"));
    expect(a.getDiagnostics().routeId).toBe(b.getDiagnostics().routeId);
    expect(b.getDiagnostics().reason).toBe("unknown-option-fallback");
  });

  it("invalidates an observed landing surface removed midflight", () => {
    const s = fixture();
    addFruit(s);
    const nav = createNavigator();
    nav.decide(s, chooseFruit);
    next(s);
    s.platforms = [];
    s.onGround = false;
    s.navigation!.body.y -= 18;
    nav.decide(s);
    expect(nav.getDiagnostics().reason).toBe("support-invalidated");
    expect(nav.getDiagnostics().phase).not.toBe("execute");
  });

  it("overrides a plan for newly observed danger, never for coin priorities", () => {
    const s = fixture();
    const nav = createNavigator();
    nav.decide(s);
    next(s);
    s.hazards = [
      {
        id: "new",
        dx: 125,
        dy: 280,
        bounds: { dx: 105, dy: 250, width: 50, height: 50 },
        kind: "stachlinger",
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    const actions = nav.decide(s);
    expect(actions).toEqual(["idle"]);
    expect(nav.getDiagnostics().reason).toBe("new-danger");
  });

  it("enters blocked with no known continuation and caches unchanged observations", () => {
    const s = fixture();
    s.platforms = [platform("last", 0, 300, 110)];
    const nav = createNavigator();
    const choose = vi.fn(() => null);
    expect(nav.decide(s, choose)).toEqual(["idle"]);
    expect(nav.getDiagnostics().phase).toBe("blocked");
    for (let i = 0; i < 20; i++) {
      next(s);
      expect(nav.decide(s, choose)).toEqual(["idle"]);
    }
    expect(choose).not.toHaveBeenCalled();
    expect(nav.getDiagnostics().reason).toBe("blocked-unchanged");
    s.platforms.push(platform("new-floor", 200, 300, 500));
    next(s);
    expect(nav.decide(s)).not.toEqual(["idle"]);
  });

  it("bounds stalled recovery, locks the failed target and never walks backwards blindly", () => {
    const s = fixture();
    const nav = createNavigator();
    const phases: string[] = [];
    const actions: string[] = [];
    for (let i = 0; i < 80; i++) {
      actions.push(...nav.decide(s));
      phases.push(nav.getDiagnostics().phase);
      next(s, 100);
    }
    expect(phases).toContain("recover");
    expect(phases).toContain("blocked");
    expect(actions).not.toContain("left");
    expect(actions).not.toContain("sprint-left");
  });

  it("keeps diagnostics copied, primitive and below the host 2 KiB envelope", () => {
    const s = fixture();
    s.platforms[0].id = "f".repeat(5000);
    const nav = createNavigator();
    nav.decide(s);
    const d = nav.getDiagnostics();
    expect(JSON.stringify(d).length).toBeLessThan(2048);
    expect(d.routeId!.length).toBeLessThanOrEqual(128);
    expect(d.navigationActions).toEqual(expect.any(Array));
    d.relevantObjectIds.push("tampered");
    expect(nav.getDiagnostics().relevantObjectIds).not.toContain("tampered");
  });

  it("preserves normal long object IDs for trace geometry lookup", () => {
    const s = fixture();
    const id = "level-messe:platform:main-route-floor-00000001";
    s.platforms[0].id = id;
    const nav = createNavigator();
    nav.decide(s);
    expect(nav.getDiagnostics().relevantObjectIds).toContain(id);
  });

  it("checks new solid walls in an executing corridor, not only its landing", () => {
    const s = fixture();
    const nav = createNavigator();
    nav.decide(s);
    next(s);
    s.platforms.push(platform("appeared", 110, 0, 20, 300));
    expect(nav.decide(s)).toEqual(["idle"]);
    expect(nav.getDiagnostics().reason).toBe("corridor-invalidated");
  });

  it("retries incomplete search only within a 500ms planning attempt, then blocks", () => {
    const s = fixture();
    s.platforms = [platform("last", 0, 300, 110)];
    s.navigation!.physicsStepMs = 0.5;
    s.coins = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      dx: 200 + i * 20,
      dy: 280,
      value: 10,
      bounds: { dx: 200 + i * 20, dy: 270, width: 20, height: 20 },
    }));
    const nav = createNavigator();
    nav.decide(s);
    expect(nav.getDiagnostics().reason).toBe("search-budget-exhausted");
    expect(nav.getDiagnostics().phase).toBe("wait");
    for (let i = 0; i < 17; i++) {
      next(s);
      nav.decide(s);
    }
    expect(nav.getDiagnostics().phase).toBe("blocked");
    expect(nav.getDiagnostics().reason).toMatch(/planning-deadline|blocked-unchanged/);
  });

  it("does not retain a blocked cache when only the physics raster changes", () => {
    const s = fixture();
    s.platforms = [platform("last", 0, 300, 110)];
    const nav = createNavigator();
    nav.decide(s);
    next(s);
    s.navigation!.physicsStepMs = 10;
    nav.decide(s);
    expect(nav.getDiagnostics().reason).not.toBe("blocked-unchanged");
  });

  it("does not continue an owned jump after an unplanned external impulse", () => {
    const s = fixture();
    addFruit(s);
    const nav = createNavigator();
    nav.decide(s, chooseFruit);
    next(s);
    s.onGround = false;
    s.velocity.vy = -820;
    s.navigation!.movement = {
      impulseKind: "boingo",
      impulseAtMs: 33,
      jumpStartedAtMs: null,
      sourceId: "new-bounce",
    };
    nav.decide(s);
    expect(nav.getDiagnostics().reason).toBe("unexpected-impulse");
    expect(nav.getDiagnostics().phase).not.toBe("execute");
  });

  it("does not keep a plan after its observed body dimensions change", () => {
    const s = fixture();
    const nav = createNavigator();
    nav.decide(s);
    next(s);
    s.navigation!.body.width *= 2;
    expect(nav.decide(s)).toEqual(["idle"]);
    expect(nav.getDiagnostics().reason).toBe("body-changed");
  });

  it("releases jump on descent so a low ceiling does not cause an automatic second jump", () => {
    const s = fixture();
    addFruit(s);
    const nav = createNavigator();
    nav.decide(s, chooseFruit);
    next(s);
    s.onGround = false;
    s.velocity.vy = 30;
    s.navigation!.body.y -= 18;
    expect(nav.decide(s)).not.toContain("jump");
  });

  it("does not exempt a previously planned stomp after the actor moves beside the bot", () => {
    const s = fixture();
    s.onGround = false;
    s.navigation!.body.y = 160;
    s.velocity.vy = 150;
    s.hazards = [
      {
        id: "frog",
        dx: 130,
        dy: 240,
        bounds: { dx: 115, dy: 230, width: 36, height: 30 },
        kind: "ninjafrog",
        active: true,
        warning: false,
        stompable: true,
        vx: 0,
        vy: 0,
      },
    ];
    const nav = createNavigator();
    nav.decide(
      s,
      (_context, options) => options.find((o) => o.route.mechanics.includes("stomp"))?.id ?? null
    );
    next(s);
    s.hazards[0].bounds = { dx: 100, dy: 160, width: 30, height: 32 };
    expect(nav.decide(s)).toEqual(["idle"]);
    expect(nav.getDiagnostics().reason).toBe("new-danger");
  });

  it("bounds diagnostics by UTF-8 bytes, even with multibyte object IDs", () => {
    const s = fixture();
    const id = String.fromCodePoint(0x1f600).repeat(100);
    s.platforms[0].id = id;
    s.coins = [
      { id, dx: 200, dy: 280, value: 10, bounds: { dx: 190, dy: 270, width: 20, height: 20 } },
    ];
    const nav = createNavigator();
    nav.decide(s, chooseFruit);
    expect(
      new TextEncoder().encode(JSON.stringify(nav.getDiagnostics())).length
    ).toBeLessThanOrEqual(2048);
  });
});
