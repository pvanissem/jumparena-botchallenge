import type { RouteOption } from "@arena/bot-contract";
import { describe, expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { planRoutes } from "./planner";

function coin(id: string, x: number, y: number, value = 10) {
  return { id, dx: x, dy: y, value, bounds: { dx: x - 10, dy: y - 10, width: 20, height: 20 } };
}
const fruitOptions = (options: RouteOption[]) => options.filter((o) => o.target.kind === "coin");

describe("local support graph", () => {
  it.each([
    [200, 280],
    [45, 280],
    [240, 150],
  ])("offers real collectible fruit at %s,%s followed by support", (x, y) => {
    const s = fixture();
    s.coins = [coin("fruit", x, y)];
    const result = planRoutes(s);
    const option = fruitOptions(result.options)[0];
    expect(option?.target.id).toBe("fruit");
    expect(option?.route.scope).toBe("target-reachable");
    expect(option?.route.landingMarginPx).toBeGreaterThanOrEqual(8);
    expect(result.plans.get(option!.id)?.every((p) => p.safe)).toBe(true);
  });

  it("never replaces the real goal vector with a fruit vector", () => {
    const s = fixture();
    s.coins = [coin("left", 45, 280)];
    const original = JSON.stringify(s);
    const result = planRoutes(s);
    expect(JSON.stringify(s)).toBe(original);
    expect(result.options.some((o) => o.target.kind === "goal" && o.route.goalProgressPx > 0)).toBe(
      true
    );
    expect(fruitOptions(result.options)[0]?.route.goalProgressPx).toBeLessThan(0);
  });

  it("rejects fruit over a void without a known subsequent landing", () => {
    const s = fixture();
    s.platforms = [platform("edge", 0, 300, 130)];
    s.coins = [coin("trap", 320, 250)];
    expect(fruitOptions(planRoutes(s).options)).toEqual([]);
  });

  it("offers a known gap crossing but never calls unseen goal reachable", () => {
    const s = fixture();
    s.platforms = [platform("start", 0, 300, 180), platform("end", 276, 300, 400)];
    const result = planRoutes(s);
    expect(
      result.options.some((o) => o.route.mechanics.includes("jump") && o.route.goalProgressPx > 180)
    ).toBe(true);
    expect(result.options.every((o) => o.route.scope === "local-progress")).toBe(true);
  });

  it("requires actual overlap of a visible goal collider", () => {
    const s = fixture();
    s.navigation!.goalBounds = { x: 250, y: 260, width: 30, height: 40 };
    const result = planRoutes(s);
    expect(
      result.options.some((o) => o.target.kind === "goal" && o.route.scope === "target-reachable")
    ).toBe(true);
  });

  it("finds an elevated fruit via an intermediate one-way landing", () => {
    const s = fixture();
    s.platforms.push(platform("first", 170, 180, 160, 16, "one-way-up"));
    s.platforms.push(platform("second", 340, 60, 180, 16, "one-way-up"));
    s.coins = [coin("high", 420, 40)];
    const result = planRoutes(s);
    for (let i = 0; i < 15 && result.resume && !fruitOptions(result.options).length; i++)
      result.resume();
    const option = fruitOptions(result.options)[0];
    expect(option).toBeDefined();
    expect(result.plans.get(option!.id)!.length).toBeGreaterThan(1);
    expect(result.plans.get(option!.id)!.length).toBeLessThanOrEqual(3);
  });

  it("routes over a low solid wall rather than walking through it", () => {
    const s = fixture();
    s.platforms.push(platform("wall", 170, 245, 50, 55));
    s.coins = [coin("behind", 290, 280)];
    const options = fruitOptions(planRoutes(s).options);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => o.route.mechanics.includes("jump"))).toBe(true);
  });

  it("keeps option IDs stable under input array permutations", () => {
    const s = fixture();
    s.coins = [coin("a", 180, 280), coin("b", 250, 150)];
    s.platforms.push(platform("ledge", 200, 210, 200, 16, "one-way-up"));
    const a = planRoutes(s).options.map((o) => o.id);
    s.coins.reverse();
    s.platforms.reverse();
    expect(planRoutes(s).options.map((o) => o.id)).toEqual(a);
  });

  it("bounds goals, states, depth, options and total integrations", () => {
    const s = fixture();
    s.coins = Array.from({ length: 30 }, (_, i) => coin(`c${i}`, 140 + i * 25, 150));
    const result = planRoutes(s);
    expect(result.stats.coinTargets).toBe(8);
    expect(result.stats.states).toBeLessThanOrEqual(32);
    expect(result.stats.maxDepth).toBeLessThanOrEqual(3);
    expect(result.stats.integrationSteps).toBeLessThanOrEqual(2048);
    expect(result.options.length).toBeLessThanOrEqual(24);
    expect(result.stats.status).toBe("search-budget-exhausted");
  });

  it("blocks an unknown final edge rather than jumping blindly", () => {
    const s = fixture();
    s.navigation!.body.x = 70;
    s.platforms = [platform("last", 0, 300, 110)];
    expect(planRoutes(s).options).toEqual([]);
  });

  it("can continue a budget-limited graph without resetting explored states", () => {
    const s = fixture();
    s.coins = Array.from({ length: 8 }, (_, i) => coin(`c${i}`, 180 + i * 25, 150));
    const first = planRoutes(s);
    expect(first.stats.status).toBe("search-budget-exhausted");
    const states = first.stats.states;
    const ids = new Set(first.options.map((o) => o.id));
    expect(first.resume).toBeTypeOf("function");
    const second = first.resume!();
    expect(second.stats.integrationSteps).toBeLessThanOrEqual(2048);
    expect(second.stats.states).toBeGreaterThanOrEqual(states);
    expect([...ids].every((id) => second.plans.has(id))).toBe(true);
  });

  it("can deliberately approach a boingo before steering to an otherwise too-high fruit", () => {
    const s = fixture();
    s.utilities = [
      {
        id: "spring",
        kind: "boingo",
        dx: 180,
        dy: 275,
        bounds: { dx: 155, dy: 260, width: 50, height: 20 },
      },
    ];
    s.coins = [coin("bonus", 350, -20)];
    const result = planRoutes(s);
    for (let i = 0; i < 15 && result.resume && !fruitOptions(result.options).length; i++)
      result.resume();
    const bonus = fruitOptions(result.options).find((o) => o.target.id === "bonus");
    expect(bonus).toBeDefined();
    expect(bonus?.route.mechanics).toContain("boingo");
    expect(result.plans.get(bonus!.id)?.every((p) => p.safe)).toBe(true);
  });
});
