import type { BotState, NavigationObservation } from "@arena/bot-contract";
import { describe, expect, it } from "vitest";
import { createMovementController } from "./index";
import { fixture, platform } from "./fixtures";
import blocked from "./test-data/samtpfote-stalled.json";
import gap from "./test-data/blitz-stalled.json";
import moving from "./test-data/moving-hazard.json";
import gapEnemy from "./test-data/gap-enemy.json";
import approachingSaw from "./test-data/approaching-saw.json";

function flat() {
  const s = fixture();
  s.position = { x: 100, y: 284 };
  s.navigation.body.x = 88;
  s.platforms = [platform("floor", -100, 16, 800)];
  return s;
}
const goal = { target: { kind: "goal" as const } };

describe("shared goal navigation", () => {
  it.each([blocked, gap, approachingSaw])(
    "makes the same decision after translating geometry and renaming objects",
    (input) => {
      const original = structuredClone(input) as BotState & { navigation: NavigationObservation };
      const translated = structuredClone(original);
      translated.position.x += 1700;
      translated.navigation.body.x += 1700;
      translated.navigation.viewport.x += 1700;
      translated.worldBounds.width += 1700;
      if (translated.navigation.goalBounds) translated.navigation.goalBounds.x += 1700;
      for (const objects of [
        translated.platforms,
        translated.coins,
        translated.utilities,
        translated.hazards,
      ])
        for (const object of objects) if (object.id) object.id = `renamed:${object.id}`;
      expect(createMovementController().navigate(translated, goal)).toEqual(
        createMovementController().navigate(original, goal)
      );
    }
  );
  it("does not report reaching a platform that does not support the observed body", () => {
    const s = flat(),
      c = createMovementController();
    s.platforms.push(platform("nearby", 16, 16, 16));
    c.navigate(s, { target: { kind: "platform", id: "nearby" } });
    expect(c.status(s).state).not.toBe("succeeded");
  });
  it("honors a new spring prohibition before the spring maneuver has launched", () => {
    const s = flat(),
      c = createMovementController();
    s.platforms.push(platform("high-ledge", 220, -250, 180, 16, "one-way-up"));
    s.utilities = [
      {
        id: "spring",
        kind: "boingo",
        dx: 40,
        dy: 8,
        bounds: { dx: 24, dy: 0, width: 32, height: 16 },
      },
    ];
    const target = { kind: "platform" as const, id: "high-ledge" };
    c.navigate(s, { target });
    expect(c.command()?.kind).toBe("boingo");
    s.tick++;
    s.navigation.observedAtMs += 33;
    c.navigate(s, { target, allowBoingo: false });
    expect(c.command()?.kind).not.toBe("boingo");
  });
  it("leaves the waiting position when a saw is closing in", () => {
    const s = structuredClone(approachingSaw) as BotState & { navigation: NavigationObservation };
    const actions = createMovementController().navigate(s, goal);
    expect(actions.length).toBeGreaterThan(0);
  });
  it("waits at a gap when the moving obstruction is on the next landing surface", () => {
    const s = structuredClone(gapEnemy) as BotState & { navigation: NavigationObservation },
      c = createMovementController();
    expect(c.navigate(s, goal)).toEqual([]);
    s.hazards = [];
    s.tick++;
    s.navigation.observedAtMs += 500;
    expect(c.navigate(s, goal)).toContain("sprint-right");
  });
  it("waits for a moving obstruction instead of abandoning an entire completed section", () => {
    const s = structuredClone(moving) as BotState & { navigation: NavigationObservation };
    const c = createMovementController();
    expect(c.navigate(s, goal)).toEqual([]);
    s.tick++;
    s.navigation.observedAtMs += 500;
    s.hazards = [];
    expect(c.navigate(s, goal)).toContain("sprint-right");
  });
  it("moves toward a goal without visitor command bookkeeping", () => {
    const c = createMovementController();
    expect(c.navigate(flat(), goal)).toContain("sprint-right");
  });
  it("pursues an explicitly selected fruit behind the bot instead of the level direction", () => {
    const s = flat();
    s.coins = [
      {
        id: "treasure",
        dx: -60,
        dy: 0,
        value: 30,
        bounds: { dx: -64, dy: -4, width: 8, height: 8 },
      },
    ];
    expect(
      createMovementController().navigate(s, { target: { kind: "coin", id: "treasure" } })
    ).toEqual(["left"]);
  });
  it("escapes the recorded overhang without requiring a visitor retreat rule", () => {
    const c = createMovementController();
    const actions = c.navigate(
      structuredClone(blocked) as BotState & { navigation: NavigationObservation },
      goal
    );
    expect(actions).toBeDefined();
    expect(actions?.some((a) => a === "left" || a === "sprint-left")).toBe(true);
  });
  it("chooses a preparatory move at the recorded gap instead of waiting forever", () => {
    const actions = createMovementController().navigate(
      structuredClone(gap) as BotState & { navigation: NavigationObservation },
      goal
    );
    expect(actions?.length).toBeGreaterThan(0);
  });
  it("reports a missing explicit target instead of silently racing to the finish", () => {
    const c = createMovementController();
    expect(c.navigate(flat(), { target: { kind: "coin", id: "gone" } })).toEqual([]);
    expect(c.status(flat())).toMatchObject({ state: "failed", reason: "target-missing" });
  });
  it("keeps steering an airborne maneuver when the strategy selects its next target", () => {
    const s = flat(),
      c = createMovementController();
    c.navigate(s, goal);
    expect(c.command()?.kind).toBe("jump");
    s.tick++;
    s.onGround = false;
    s.velocity.vy = -200;
    s.navigation.observedAtMs = 33;
    s.navigation.body.y -= 15;
    s.coins = [{ id: "next", dx: 200, dy: 0, value: 10 }];
    expect(c.navigate(s, { target: { kind: "coin", id: "next" } })).toContain("sprint-right");
  });
  it("resets stale terminal state after a new epoch", () => {
    const s = flat(),
      c = createMovementController();
    c.navigate(s, { target: { kind: "coin", id: "gone" } });
    s.navigation.epoch++;
    s.tick++;
    expect(c.navigate(s, goal)).toContain("sprint-right");
  });
  it("does not report an intermediate motor failure as a failed strategic target", () => {
    const s = flat(),
      c = createMovementController();
    c.navigate(s, goal);
    s.tick++;
    s.navigation.observedAtMs = 900;
    expect(c.status(s).state).toBe("running");
  });
  it("reports no route promptly for a permanent enclosure without a moving hazard", () => {
    const s = flat(),
      c = createMovementController();
    s.platforms = [platform("floor", -15, 16, 30), platform("roof", -100, -40, 800)];
    for (let i = 0; i <= 100; i++) {
      s.tick = i;
      s.navigation.observedAtMs = i * 33;
      c.navigate(s, goal);
    }
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "no-route" });
  });
  it("bounds repeated failures when the observed body cannot make progress", () => {
    const s = flat(),
      c = createMovementController();
    for (let i = 0; i <= 650; i++) {
      s.tick = i;
      s.timeElapsedMs = i * 33;
      s.navigation.observedAtMs = i * 33;
      c.navigate(s, goal);
    }
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "navigation-blocked" });
    s.tick++;
    s.navigation.observedAtMs += 33;
    expect(c.navigate(s, goal)).toEqual([]);
  });
  it("keeps its recovery budget for equivalent intents with different property order", () => {
    const s = flat(),
      c = createMovementController();
    for (let i = 0; i <= 650; i++) {
      s.tick = i;
      s.navigation.observedAtMs = i * 33;
      c.navigate(
        s,
        i % 2
          ? { target: { kind: "goal" }, caution: "normal" }
          : { caution: "normal", target: { kind: "goal" } }
      );
    }
    expect(c.status(s)).toMatchObject({ state: "failed", reason: "navigation-blocked" });
  });
  it("does not substitute a more valuable fruit for the visitor's explicit target", () => {
    const s = flat(),
      c = createMovementController();
    s.coins = [
      { id: "chosen", dx: 200, dy: 0, value: 1, bounds: { dx: 196, dy: -4, width: 8, height: 8 } },
      { id: "other", dx: -60, dy: 0, value: 100, bounds: { dx: -64, dy: -4, width: 8, height: 8 } },
    ];
    expect(c.navigate(s, { target: { kind: "coin", id: "chosen" } })).toContain("sprint-right");
  });
  it("selects a preparatory jump at the recorded fire passage", () => {
    const s = structuredClone(gap) as BotState & { navigation: NavigationObservation },
      c = createMovementController();
    // The fire passage needs the spring behind the bot, not another approach
    // to the already exhausted edge. Selecting an upward/backward maneuver is
    // preparation toward the unchanged goal.
    c.navigate(s, goal);
    const first = c.command();
    expect(first).not.toBeNull();
    expect(first?.kind).not.toBe("walk");
  });
});
