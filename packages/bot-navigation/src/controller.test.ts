import { describe, expect, it } from "vitest";
import * as controllers from "./controller";
import { fixture, platform } from "./fixtures";

const make = () => controllers.createMovementController();
function next(s: ReturnType<typeof fixture>, ms = 33) {
  s.tick++;
  s.navigation.observedAtMs += ms;
  s.navigation.frame += 2;
}
function air(s: ReturnType<typeof fixture>, x = 130, y = 200) {
  next(s);
  s.onGround = false;
  s.navigation.body.x = x;
  s.navigation.body.y = y;
  s.velocity.vy = -100;
}
function land(s: ReturnType<typeof fixture>, x = 220, y = 268) {
  next(s);
  s.onGround = true;
  s.navigation.body.x = x;
  s.navigation.body.y = y;
  s.velocity.vy = 0;
}
describe("observed movement controller", () => {
  it("walks towards an explicit point and reports completion before the next run", () => {
    const s = fixture(),
      c = make();
    expect(c.run(s, { id: "a", kind: "walk", x: 150 })).toEqual(["right"]);
    next(s);
    s.navigation.body.x = 138;
    expect(c.status(s).state).toBe("succeeded");
    expect(c.run(s, { id: "a", kind: "walk", x: 150 })).toEqual([]);
  });
  it("replaces an active command by a new ID and rejects changed parameters for the same ID", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "a", kind: "walk", x: 150 });
    next(s);
    expect(c.run(s, { id: "b", kind: "walk", x: 40 })).toEqual(["left"]);
    next(s);
    expect(() => c.run(s, { id: "b", kind: "walk", x: 100 })).toThrow(/ID/);
  });
  it("does not silently jump or walk off unsupported ground", () => {
    const s = fixture(),
      c = make();
    s.platforms = [platform("edge", 0, 300, 108)];
    expect(c.run(s, { id: "a", kind: "walk", x: 200 })).toEqual([]);
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "gap-ahead" });
  });
  it("blocks walking into an observed active hazard", () => {
    const s = fixture(),
      c = make();
    s.hazards = [
      {
        id: "spike",
        kind: "stachlinger",
        dx: 108,
        dy: 275,
        bounds: { dx: 108, dy: 275, width: 15, height: 25 },
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    expect(c.run(s, { id: "a", kind: "walk", x: 200 })).toEqual([]);
    expect(c.status(s).reason).toBe("danger-ahead");
  });
  it("keeps steering during a jump and succeeds only on the requested landing region", () => {
    const s = fixture(),
      c = make(),
      cmd = { id: "j", kind: "jump" as const, platformId: "floor", x: 232 };
    expect(c.run(s, cmd)).toContain("jump");
    expect(c.status(s).state).toBe("running");
    air(s);
    expect(c.run(s, cmd)).toContain("right");
    land(s);
    expect(c.status(s)).toMatchObject({ state: "succeeded", phase: "landing" });
  });
  it("fails a wrong landing instead of reporting success just because the bot is grounded", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "j", kind: "jump", platformId: "floor", x: 232 });
    air(s);
    c.status(s);
    land(s, 80);
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "wrong-landing" });
  });
  it("counts hold time from the observed launch, not command creation", () => {
    const s = fixture(),
      c = make(),
      cmd = { id: "j", kind: "jump" as const, platformId: "floor", x: 232, holdMs: 180 };
    c.run(s, cmd);
    air(s);
    s.navigation.observedAtMs = 200;
    s.navigation.movement = {
      jumpStartedAtMs: 100,
      impulseKind: "jump",
      impulseAtMs: 100,
      sourceId: null,
    };
    expect(c.run(s, cmd)).toContain("jump");
    next(s, 100);
    expect(c.run(s, cmd)).not.toContain("jump");
  });
  it("requires a visible target and never substitutes one", () => {
    const s = fixture(),
      c = make();
    expect(c.run(s, { id: "j", kind: "jump", platformId: "missing" })).toEqual([]);
    expect(c.status(s).reason).toBe("target-missing");
  });
  it("clears command ownership on reset and respawn", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "a", kind: "walk", x: 150 });
    c.reset();
    expect(c.status(s).state).toBe("idle");
    next(s);
    c.run(s, { id: "b", kind: "walk", x: 200 });
    next(s);
    s.navigation.epoch++;
    expect(c.status(s)).toMatchObject({ commandId: null, state: "idle" });
  });
  it("rejects non-finite commands without issuing controls", () => {
    const s = fixture(),
      c = make();
    expect(c.run(s, { id: "a", kind: "walk", x: NaN })).toEqual([]);
    expect(c.status(s).reason).toBe("invalid-command");
  });
  it("detects a stalled command from observations", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "a", kind: "walk", x: 150 });
    next(s, 900);
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "stalled" });
  });
  it("steers to the boingo until its actual impulse then toward the destination", () => {
    const s = fixture(),
      c = make();
    s.platforms.push(platform("upper", 350, 0, 240, 16, "one-way-up"));
    s.utilities = [
      {
        id: "b",
        kind: "boingo",
        dx: 150,
        dy: 290,
        bounds: { dx: 135, dy: 280, width: 30, height: 20 },
      },
    ];
    const cmd = { id: "b1", kind: "boingo" as const, utilityId: "b", platformId: "upper", x: 450 };
    expect(c.run(s, cmd)).toContain("right");
    air(s, 138, 210);
    expect(c.run(s, cmd)).not.toContain("right");
    next(s);
    s.navigation.movement = {
      impulseKind: "boingo",
      impulseAtMs: 50,
      sourceId: "b",
      jumpStartedAtMs: null,
    };
    expect(c.run(s, cmd)).toContain("right");
    expect(c.status(s).phase).toBe("flight");
    land(s, 438, -32);
    expect(c.status(s).state).toBe("succeeded");
  });
  it("does not claim a bounce when the bot lands without the requested impulse", () => {
    const s = fixture(),
      c = make();
    s.utilities = [
      {
        id: "b",
        kind: "boingo",
        dx: 100,
        dy: 290,
        bounds: { dx: 85, dy: 280, width: 30, height: 20 },
      },
    ];
    c.run(s, { id: "b1", kind: "boingo", utilityId: "b", platformId: "floor", x: 232 });
    air(s);
    c.status(s);
    land(s);
    expect(c.status(s).reason).toBe("bounce-missed");
  });

  it("keeps invalid-start failures sticky until a new command ID", () => {
    const s = fixture(),
      c = make(),
      cmd = { id: "j", kind: "jump" as const, platformId: "later" };
    c.run(s, cmd);
    next(s);
    s.platforms.push(platform("later", 0, 300, 1000));
    expect(c.run(s, cmd)).toEqual([]);
    expect(c.status(s).reason).toBe("target-missing");
  });
  it("compares command values independently of property order", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "w", kind: "walk", x: 150 });
    next(s);
    expect(() => c.run(s, { x: 150, kind: "walk", id: "w" })).not.toThrow();
  });
  it("ignores impulses that already existed when a command was created", () => {
    const s = fixture(),
      c = make();
    s.navigation.lastImpulse = { sequence: 1, kind: "jump", atMs: 0, sourceId: null };
    s.navigation.movement = {
      impulseKind: "jump",
      impulseAtMs: 0,
      jumpStartedAtMs: 0,
      sourceId: null,
    };
    c.run(s, { id: "j", kind: "jump", platformId: "floor", x: 232 });
    expect(c.status(s).state).toBe("running");
  });
  it("recognizes a launch and landing between observations from the persistent impulse", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "j", kind: "jump", platformId: "floor", x: 232 });
    land(s);
    s.navigation.lastImpulse = { sequence: 1, kind: "jump", atMs: 10, sourceId: null };
    expect(c.status(s).state).toBe("succeeded");
  });

  it("allows a new landing target mid-flight without inventing another jump", () => {
    const s = fixture(),
      c = make();
    c.run(s, { id: "first", kind: "jump", platformId: "floor", x: 232 });
    air(s, 130, 200);
    expect(c.run(s, { id: "second", kind: "jump", platformId: "floor", x: 60 })).toEqual(["left"]);
    expect(c.status(s).state).toBe("running");
  });

  it("holds a default sprint jump through its observed ascent", () => {
    const s = fixture(),
      c = make();
    const command = {
      id: "full",
      kind: "jump" as const,
      platformId: "floor",
      x: 232,
      sprint: true,
    };
    c.run(s, command);
    air(s);
    s.navigation.lastImpulse = { sequence: 1, kind: "jump", atMs: 1, sourceId: null };
    c.status(s);
    next(s, 650);
    s.velocity.vy = -40;
    expect(c.run(s, command)).toContain("jump");
  });

  it("walks inward from a checkpoint on a platform edge, but not farther outward", () => {
    const s = fixture();
    s.navigation.body.x = -12;
    expect(make().run(s, { id: "in", kind: "walk", x: 100 })).toEqual(["right"]);
    const outward = make();
    expect(outward.run(s, { id: "out", kind: "walk", x: -100 })).toEqual([]);
    expect(outward.status(s).reason).toBe("gap-ahead");
  });
});

it("accepts the center of a narrow but physically supporting block", () => {
  const s = fixture(),
    c = make();
  s.platforms.push(platform("step", 180, 220, 28));
  expect(c.run(s, { id: "narrow", kind: "jump", platformId: "step", x: 194 })).toContain("jump");
});

it("can explicitly run up before launching a jump", () => {
  const s = fixture(),
    c = make();
  const command = {
    id: "run-up",
    kind: "jump" as const,
    platformId: "floor",
    x: 300,
    sprint: true,
    runUpMs: 100,
  };
  expect(c.run(s, command)).toEqual(["sprint-right"]);
  next(s, 110);
  expect(c.run(s, command)).toContain("jump");
});

it("executes a drop without a jump and verifies the actual landing", () => {
  const s = fixture(),
    c = make();
  s.platforms.push(platform("lower", 180, 416, 220));
  const command = { id: "drop", kind: "drop" as const, platformId: "lower", x: 200 };
  expect(c.run(s, command)).toEqual(["right"]);
  next(s, 100);
  air(s);
  c.status(s);
  next(s, 500);
  s.onGround = true;
  s.velocity.vy = 0;
  s.navigation.body.x = 188;
  s.navigation.body.y = 384;
  expect(c.status(s).state).toBe("succeeded");
});
