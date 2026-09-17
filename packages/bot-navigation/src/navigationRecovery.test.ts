import type { NavigationIntent } from "@arena/bot-contract";
import { expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { createMovementController } from "./index";

const goal = { target: { kind: "goal" as const } };
function floor() {
  const s = fixture();
  s.position = { x: 92, y: 284 };
  s.platforms = [platform("floor", -92, 16, 1000)];
  return s;
}
it("keeps repeated successful backwards commands from forming an endless custom loop", () => {
  const s = floor(),
    c = createMovementController();
  const offered: number[] = [];
  const intent: NavigationIntent = {
    ...goal,
    choose(moves) {
      const retreat = moves.find((m) => m.kind === "walk" && m.progress < 0);
      offered.push(retreat ? 1 : 0);
      return retreat?.id ?? null;
    },
  };
  for (let round = 0; round < 5; round++) {
    s.navigation.body.x = 180;
    s.tick++;
    s.navigation.observedAtMs += 1000;
    c.navigate(s, intent);
    const command = c.command();
    if (command?.kind === "walk") {
      s.navigation.body.x = command.x - 12;
      s.tick++;
      s.navigation.observedAtMs += 300;
      c.status(s);
    }
  }
  expect(offered.slice(-2)).toEqual([0, 0]);
});
it("reconsiders a blocked goal when a visible hazard changes, without resetting on identical ticks", () => {
  const s = floor(),
    c = createMovementController();
  s.hazards = [
    {
      id: "frog",
      kind: "ninjafrog",
      dx: 400,
      dy: 0,
      bounds: { dx: 390, dy: -10, width: 20, height: 26 },
      active: true,
      warning: false,
      stompable: true,
      vx: 60,
      vy: 0,
    },
  ];
  for (let tick = 0; tick < 650; tick++) {
    s.tick = tick;
    s.navigation.observedAtMs = tick * 33;
    c.navigate(s, goal);
  }
  expect(c.status(s).state).toBe("failed");
  s.tick++;
  s.navigation.observedAtMs += 33;
  expect(c.navigate(s, goal)).toEqual([]);
  s.hazards = [];
  s.tick++;
  s.navigation.observedAtMs += 33;
  expect(c.navigate(s, goal)).toContain("sprint-right");
  expect(c.status(s).state).toBe("running");
});
it("prefers walking on open ground without making a selector repair the motor", () => {
  const s = floor(),
    c = createMovementController();
  c.navigate(s, { ...goal, movement: "ground" } as NavigationIntent);
  expect(c.command()?.kind).toBe("walk");
});
it("accepts boingos as a fallback policy rather than requiring a visitor selector", () => {
  expect(() =>
    createMovementController().navigate(floor(), {
      ...goal,
      allowBoingo: "fallback",
    } as NavigationIntent)
  ).not.toThrow();
});
it("withholds boingos while forward alternatives exist and uses one when only retreat remains", () => {
  for (const narrow of [false, true]) {
    const s = floor(),
      c = createMovementController();
    s.platforms = [
      platform("floor", -92, 16, narrow ? 120 : 1000),
      platform("high", 220, -250, 180, 16, "one-way-up"),
    ];
    s.utilities = [
      {
        id: "spring",
        kind: "boingo",
        dx: 0,
        dy: 16,
        bounds: { dx: -16, dy: 16, width: 32, height: 16 },
      },
    ];
    c.navigate(s, {
      ...goal,
      allowBoingo: "fallback",
      choose(moves) {
        if (!narrow) expect(moves.some((m) => m.kind === "boingo")).toBe(false);
        return moves.find((m) => m.kind === "boingo")?.id ?? moves[0]?.id ?? null;
      },
    });
    if (narrow) expect(c.command()?.kind).toBe("boingo");
    else expect(c.command()?.kind).not.toBe("boingo");
  }
});
