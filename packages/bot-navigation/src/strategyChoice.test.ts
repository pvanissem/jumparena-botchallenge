import { describe, expect, it } from "vitest";
import type { NavigationChoice } from "@arena/bot-contract";
import { createMovementController } from "./index";
import { fixture, platform } from "./fixtures";

function scene() {
  const s = fixture();
  s.position = { x: 92, y: 284 };
  s.platforms = [
    platform("floor", -92, 16, 1000),
    platform("upper", 180, -100, 160, 16, "one-way-up"),
  ];
  return s;
}
const target = { kind: "goal" as const };
describe("visitor movement selection", () => {
  it("does not mislabel missing movement options as deliberate visitor waiting", () => {
    const s = scene(),
      c = createMovementController();
    s.platforms = [platform("floor", -15, 16, 30), platform("roof", -100, -40, 800)];
    for (let i = 0; i <= 100; i++) {
      s.tick = i;
      s.navigation.observedAtMs = i * 33;
      c.navigate(s, { target, choose: (moves) => moves[0]?.id ?? null });
    }
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "no-route" });
  });
  it("still bounds failed motor attempts under a custom selector", () => {
    const s = scene(),
      c = createMovementController();
    for (let i = 0; i < 700; i++) {
      s.tick = i;
      s.navigation.observedAtMs = i * 33;
      c.navigate(s, { target, choose: (moves) => moves[0]?.id ?? null });
    }
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "navigation-blocked" });
  });
  it("does not count deliberate waiting as a motor stall", () => {
    const s = scene(),
      c = createMovementController();
    for (let i = 0; i < 700; i++) {
      s.tick = i;
      s.navigation.observedAtMs = i * 33;
      c.navigate(s, { target, choose: () => null });
    }
    expect(c.status(s)).toMatchObject({ state: "running", reason: "strategy-wait" });
  });
  it("lets a visitor jump across an enemy or deliberately wait in the same situation", () => {
    const s = scene();
    s.platforms = [platform("floor", -92, 16, 1000)];
    s.hazards = [
      {
        kind: "ninjafrog",
        dx: 140,
        dy: 0,
        active: true,
        warning: false,
        stompable: true,
        vx: 0,
        vy: 0,
        bounds: { dx: 130, dy: -16, width: 20, height: 32 },
      },
    ];
    const jumper = createMovementController(),
      waiter = createMovementController();
    jumper.navigate(s, {
      target,
      choose: (moves) => moves.find((m) => m.kind === "jump" && m.crossesEnemy)?.id ?? null,
    });
    expect(jumper.command()?.kind).toBe("jump");
    expect(waiter.navigate(s, { target, choose: () => null })).toEqual([]);
    expect(waiter.status(s).reason).toBe("strategy-wait");
  });
  it("offers distinct short and long jumps without requiring hold durations", () => {
    const s = scene();
    s.platforms = [platform("floor", -92, 16, 1000)];
    const chosen: number[] = [];
    for (const direction of [1, -1]) {
      createMovementController().navigate(s, {
        target,
        choose: (moves) => {
          const jumps = moves.filter((m) => m.kind === "jump" && m.progress > 100);
          jumps.sort((a, b) => direction * (a.durationMs - b.durationMs));
          chosen.push(jumps[0].durationMs);
          return jumps[0].id;
        },
      });
    }
    expect(chosen[0]).toBeLessThan(chosen[1]);
  });
  it("lets the same goal choose walking or an upper route without motor bookkeeping", () => {
    const s = scene(),
      walker = createMovementController(),
      climber = createMovementController();
    walker.navigate(s, {
      target,
      choose: (moves: readonly NavigationChoice[]) =>
        moves.find((m) => m.kind === "walk")?.id ?? null,
    });
    climber.navigate(s, {
      target,
      choose: (moves: readonly NavigationChoice[]) =>
        moves.find((m) => m.platformId === "upper")?.id ?? null,
    });
    expect(walker.command()?.kind).toBe("walk");
    expect(climber.command()).toMatchObject({ kind: "jump", platformId: "upper" });
  });
  it("can deliberately wait then select a movement on the next observation", () => {
    const s = scene(),
      c = createMovementController();
    expect(c.navigate(s, { target, choose: () => null })).toEqual([]);
    expect(c.status(s).reason).toBe("strategy-wait");
    s.tick++;
    s.navigation.observedAtMs += 33;
    expect(
      c.navigate(s, { target, choose: (moves) => moves[0]?.id ?? null }).length
    ).toBeGreaterThan(0);
  });
  it("keeps an accepted flight despite a freshly created selector each tick", () => {
    const s = scene(),
      c = createMovementController();
    c.navigate(s, {
      target,
      choose: (moves) => moves.find((m) => m.platformId === "upper")?.id ?? null,
    });
    const id = c.command()?.id;
    expect(c.command()?.kind).toBe("jump");
    s.tick++;
    s.onGround = false;
    s.velocity.vy = -200;
    s.navigation.body.y -= 10;
    s.navigation.observedAtMs += 33;
    c.navigate(s, {
      target,
      choose: () => {
        throw Error("must finish flight first");
      },
    });
    expect(c.command()?.id).toBe(id);
  });
  it("rejects a fabricated choice instead of accepting arbitrary commands", () => {
    expect(() =>
      createMovementController().navigate(scene(), { target, choose: () => "invented" })
    ).toThrow(/Auswahl/);
  });
  it("provides immutable, meaningful route data", () => {
    let observed = false;
    createMovementController().navigate(scene(), {
      target,
      choose: (moves) => {
        observed = true;
        expect(Object.isFrozen(moves)).toBe(true);
        const upper = moves.find((m) => m.platformId === "upper");
        expect(upper?.rise).toBe(116);
        expect(upper?.distance).toBeGreaterThan(0);
        expect(Object.isFrozen(upper)).toBe(true);
        return upper?.id ?? null;
      },
    });
    expect(observed).toBe(true);
  });
});
