import { describe, expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { advanceMovement, motionFromState } from "./movement";
import { predict } from "./predictor";

describe("contract-tuned movement", () => {
  it("ramps sprint and resets on walk, idle and reversal", () => {
    const s = fixture();
    let m = motionFromState(s);
    for (let i = 0; i < 30; i++) m = advanceMovement(m, ["sprint-right"], s.tuning, i * 20, 20);
    expect(m.vx).toBe(320);
    expect(advanceMovement(m, ["right"], s.tuning, 600, 20).vx).toBe(200);
    expect(advanceMovement(m, ["idle"], s.tuning, 600, 20).sprintMs).toBe(0);
    expect(advanceMovement(m, ["sprint-left"], s.tuning, 600, 20).vx).toBeCloseTo(-205.3333);
  });

  it("uses the last horizontal raw action and holds jump independently", () => {
    const s = fixture();
    const m = advanceMovement(
      motionFromState(s),
      ["left", "jump", "sprint-right"],
      s.tuning,
      0,
      20
    );
    expect(m.vx).toBeGreaterThan(200);
    expect(m.vy).toBeLessThan(-560);
    expect(m.impulseKind).toBe("jump");
  });

  it("treats idle as no horizontal command, matching mixed raw arena actions", () => {
    const s = fixture();
    expect(advanceMovement(motionFromState(s), ["right", "idle"], s.tuning, 0, 20).vx).toBe(200);
  });

  it("cuts normal jumps only after the minimum hold", () => {
    const s = fixture();
    const jump = advanceMovement(motionFromState(s), ["jump"], s.tuning, 0, 20);
    expect(advanceMovement(jump, [], s.tuning, 179, 20).vy).toBe(-560);
    expect(advanceMovement(jump, [], s.tuning, 180, 20).vy).toBe(0);
    expect(advanceMovement(jump, ["jump"], s.tuning, 200, 20).vy).toBe(-560);
  });

  it.each(["boingo", "stomp"] as const)(
    "does not cut or overwrite an observed %s impulse",
    (kind) => {
      const s = fixture();
      s.navigation!.movement = {
        impulseKind: kind,
        impulseAtMs: 10,
        jumpStartedAtMs: 0,
        sourceId: "bounce",
      };
      s.velocity.vy = -400;
      const m = advanceMovement(motionFromState(s), ["jump"], s.tuning, 500, 20);
      expect(m.vy).toBe(-400);
      expect(m.jumpStartedAtMs).toBeNull();
    }
  );
});

describe("bounded collision predictor (not a Phaser integration test)", () => {
  it("walks with actual body dimensions and a concrete support", () => {
    const s = fixture();
    s.navigation!.body.width = 40;
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 200, holdMs: 0 });
    expect(p.safe).toBe(true);
    expect(p.landing?.platformId).toBe("floor");
    expect(p.end.body.width).toBe(40);
    expect(p.landing!.marginPx).toBeGreaterThanOrEqual(8);
  });

  it("proves downward crossing after a jump, not merely proximity", () => {
    const p = predict(fixture(), {
      direction: 1,
      sprint: false,
      jump: true,
      aimX: 260,
      holdMs: 600,
    });
    expect(p.safe).toBe(true);
    expect(p.landing?.crossedFromAbove).toBe(true);
    expect(p.mechanics).toContain("jump");
    expect(p.end.body.y).toBe(268);
  });

  it("uses the reported physics raster", () => {
    const s = fixture();
    s.navigation!.physicsStepMs = 10;
    const p = predict(s, { direction: 1, sprint: false, jump: true, aimX: 200, holdMs: 180 });
    expect(p.durationMs % 10).toBe(0);
    expect(p.steps).toBe(p.durationMs / 10);
  });

  it("never substitutes world bounds or goal proximity for missing floor", () => {
    const s = fixture();
    s.platforms = [];
    const p = predict(s, { direction: 1, sprint: true, jump: true, aimX: 300, holdMs: 600 });
    expect(p.safe).toBe(false);
    expect(p.landing).toBeNull();
  });

  it("rejects landing surfaces narrower than body plus two margins", () => {
    const s = fixture();
    s.platforms = [platform("tiny", 240, 300, 30)];
    const p = predict(s, { direction: 1, sprint: false, jump: true, aimX: 255, holdMs: 600 });
    expect(p.safe).toBe(false);
  });

  it("cannot tunnel through a solid wall", () => {
    const s = fixture();
    s.platforms.push(platform("wall", 180, 0, 16, 300));
    const p = predict(s, { direction: 1, sprint: true, jump: false, aimX: 350, holdMs: 0 });
    expect(p.safe).toBe(false);
    expect(p.reason).toBe("wall-contact");
    expect(p.end.body.x + p.end.body.width).toBeLessThanOrEqual(180);
  });

  it("resolves a solid ceiling and lands below it", () => {
    const s = fixture();
    s.platforms.push(platform("ceiling", 0, 190, 500, 16));
    const p = predict(s, { direction: 1, sprint: false, jump: true, aimX: 160, holdMs: 600 });
    expect(p.contacts).toContain("ceiling:ceiling");
    expect(p.safe).toBe(true);
    expect(p.landing?.platformId).toBe("floor");
  });

  it("passes upward through one-way and lands on its top", () => {
    const s = fixture();
    s.platforms.push(platform("ledge", 120, 210, 260, 16, "one-way-up"));
    const p = predict(s, { direction: 1, sprint: false, jump: true, aimX: 220, holdMs: 600 });
    expect(p.contacts).not.toContain("ceiling:ledge");
    expect(p.safe).toBe(true);
    expect(p.landing?.platformId).toBe("ledge");
  });

  it("checks distant hazards in the entire flight corridor", () => {
    const s = fixture();
    s.hazards.push({
      id: "far",
      dx: 310,
      dy: 0,
      bounds: { dx: 300, dy: 0, width: 40, height: 300 },
      kind: "stachlinger",
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    });
    const p = predict(s, { direction: 1, sprint: true, jump: true, aimX: 450, holdMs: 600 });
    expect(p.safe).toBe(false);
    expect(p.reason).toBe("hazard-contact");
  });

  it("ends at the integration budget without claiming unreachable", () => {
    const p = predict(
      fixture(),
      { direction: 1, sprint: true, jump: true, aimX: 450, holdMs: 600 },
      3
    );
    expect(p.steps).toBe(3);
    expect(p.reason).toBe("search-budget-exhausted");
    expect(p.safe).toBe(false);
  });

  it.each(["boingo", "stomp"] as const)(
    "models %s contact, impulse and a subsequent landing",
    (kind) => {
      const s = fixture();
      s.onGround = false;
      s.navigation!.body = { x: 80, y: 160, width: 24, height: 32 };
      s.velocity.vy = 150;
      const bounds = { dx: 115, dy: 230, width: 36, height: 30 };
      if (kind === "boingo") s.utilities = [{ id: "bounce", dx: 130, dy: 240, bounds, kind }];
      else
        s.hazards = [
          {
            id: "bounce",
            dx: 130,
            dy: 240,
            bounds,
            kind: "ninjafrog",
            active: true,
            warning: false,
            stompable: true,
            vx: 0,
            vy: 0,
          },
        ];
      const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 300, holdMs: 0 });
      expect(p.contacts).toContain(`${kind}:bounce`);
      expect(p.mechanics).toContain(kind);
      expect(p.safe).toBe(true);
      expect(p.landing?.platformId).toBe("floor");
      expect(p.samples.some((sample) => sample.impulseKind === kind)).toBe(true);
    }
  );

  it("does not call a side collision with a stompable actor a stomp", () => {
    const s = fixture();
    s.hazards = [
      {
        id: "frog",
        dx: 150,
        dy: 280,
        bounds: { dx: 140, dy: 270, width: 30, height: 30 },
        kind: "ninjafrog",
        active: true,
        warning: false,
        stompable: true,
        vx: 0,
        vy: 0,
      },
    ];
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 300, holdMs: 0 });
    expect(p.safe).toBe(false);
    expect(p.mechanics).not.toContain("stomp");
  });

  it("does not claim a bounce contact alone guarantees a landing", () => {
    const s = fixture();
    s.onGround = false;
    s.platforms = [];
    s.navigation!.body.y = 160;
    s.velocity.vy = 150;
    s.utilities = [
      {
        id: "bounce",
        dx: 130,
        dy: 240,
        bounds: { dx: 115, dy: 230, width: 36, height: 30 },
        kind: "boingo",
      },
    ];
    const p = predict(s, { direction: 1, sprint: true, jump: false, aimX: 500, holdMs: 0 });
    expect(p.contacts).toContain("boingo:bounce");
    expect(p.safe).toBe(false);
    expect(p.landing).toBeNull();
  });

  it("uses object-relative bounds rather than sprite centers or tuning body size", () => {
    const s = fixture();
    s.position = { x: 50, y: 100 };
    s.platforms = [platform("offset", -50, 200, 1000)];
    s.coins = [
      {
        id: "fruit",
        dx: 999,
        dy: 999,
        value: 5,
        bounds: { dx: 120, dy: 170, width: 20, height: 20 },
      },
    ];
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 200, holdMs: 0 });
    expect(p.safe).toBe(true);
    expect(p.collectedIds).toContain("fruit");
  });

  it("never claims collection from center proximity without a pickup collider", () => {
    const s = fixture();
    s.coins = [{ id: "fruit", dx: 180, dy: 280, value: 5 }];
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 200, holdMs: 0 });
    expect(p.collectedIds).toEqual([]);
  });

  it("does not launch a grounded jump from an unsupported snapshot", () => {
    const s = fixture();
    s.platforms = [platform("far", 250, 300, 300)];
    expect(
      predict(s, { direction: 1, sprint: false, jump: true, aimX: 300, holdMs: 600 }).safe
    ).toBe(false);
  });

  it("does not invent one-way drop-through", () => {
    const s = fixture();
    s.platforms = [
      platform("one-way", 0, 300, 500, 16, "one-way-up"),
      platform("lower", 0, 420, 700),
    ];
    const p = predict(s, { direction: 0, sprint: false, jump: false, aimX: 92, holdMs: 0 });
    expect(p.landing?.platformId).toBe("one-way");
    expect(p.end.body.y).toBe(268);
  });

  it("walks off an edge to a known lower support with a drop mechanic", () => {
    const s = fixture();
    s.platforms = [platform("upper", 0, 300, 160), platform("lower", 160, 420, 500)];
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 270, holdMs: 0 });
    expect(p.safe).toBe(true);
    expect(p.landing?.platformId).toBe("lower");
    expect(p.mechanics).toContain("drop");
  });

  it("rejects a fast moving hazard crossing between physics samples", () => {
    const s = fixture();
    s.hazards = [
      {
        id: "fast",
        dx: 20,
        dy: 280,
        bounds: { dx: 10, dy: 260, width: 20, height: 40 },
        kind: "kugelblitz",
        active: true,
        warning: false,
        stompable: false,
        vx: 12000,
        vy: 0,
      },
    ];
    expect(
      predict(s, { direction: 1, sprint: false, jump: false, aimX: 200, holdMs: 0 }).safe
    ).toBe(false);
  });

  it("does not allow a missing boingo collider to certify an unaffected path", () => {
    const s = fixture();
    s.utilities = [{ id: "unknown", dx: 180, dy: 280, kind: "boingo" }];
    const p = predict(s, { direction: 1, sprint: false, jump: false, aimX: 200, holdMs: 0 });
    expect(p.safe).toBe(false);
    expect(p.reason).toBe("missing-utility-bounds");
  });

  it("rejects invalid tuning rather than generating nonfinite trajectories", () => {
    const s = fixture();
    s.tuning.sprintMoveSpeed = Number.NaN;
    const p = predict(s, { direction: 1, sprint: true, jump: true, aimX: 200, holdMs: 0 });
    expect(p.reason).toBe("invalid-tuning");
    expect(p.steps).toBe(0);
  });

  it("never accepts support beyond the actual world bounds", () => {
    const s = fixture();
    s.worldBounds.width = 150;
    const p = predict(s, { direction: 1, sprint: true, jump: false, aimX: 180, holdMs: 0 });
    expect(p.safe).toBe(false);
  });

  it("checks a solid corner crossed diagonally instead of certifying a flight through it", () => {
    const s = fixture();
    s.onGround = false;
    s.navigation!.body = { x: 80, y: 260, width: 24, height: 32 };
    s.velocity.vy = 900;
    s.navigation!.physicsStepMs = 100;
    s.platforms = [platform("wall", 110, 300, 10, 400), platform("floor", 0, 500, 800)];
    const p = predict(s, { direction: 1, sprint: true, jump: false, aimX: 300, holdMs: 0 });
    expect(p.safe).toBe(false);
  });

  it("holds steering between decisions, not independently at every physics step", () => {
    const s = fixture();
    s.tuning.tickMs = 100;
    const p = predict(s, { direction: 1, sprint: false, jump: true, aimX: 100, holdMs: 180 });
    expect(
      p.samples
        .slice(0, 6)
        .every((sample) => JSON.stringify(sample.actions) === JSON.stringify(p.samples[0].actions))
    ).toBe(true);
  });
});
