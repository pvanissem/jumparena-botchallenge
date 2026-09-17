// @vitest-environment node
import { readFileSync } from "node:fs";
import {
  type BotState,
  checkStaticGuard,
  type NavigationIntent,
  validateBotModule,
} from "@arena/bot-contract";
import { createMovementController } from "@arena/bot-navigation";
import { expect, it } from "vitest";
import { fixture, platform } from "../../../packages/bot-navigation/src/fixtures";

it("the ground stomper runs on open ground and attacks a moving frog without visitor motor code", () => {
  const s = fixture();
  s.position = { x: 92, y: 284 };
  s.platforms = [platform("floor", -92, 16, 900)];
  const walker = createMovementController();
  walker.navigate(s, choose("stomper", s));
  expect(walker.command()?.kind).toBe("walk");
  s.hazards = [
    {
      id: "frog",
      kind: "ninjafrog",
      dx: 120,
      dy: 0,
      bounds: { dx: 110, dy: -10, width: 20, height: 26 },
      active: true,
      warning: false,
      stompable: true,
      vx: 60,
      vy: 0,
    },
  ];
  const attacker = createMovementController();
  attacker.navigate(s, choose("stomper", s));
  expect(attacker.command()).toMatchObject({ kind: "stomp", hazardId: "frog" });
});

function choose(file: string, s: BotState) {
  const source = readFileSync(
    new URL(`../../../examples/navigation/${file}.js`, import.meta.url),
    "utf8"
  );
  expect(checkStaticGuard(source).allowed).toBe(true);
  const bot = new Function(source.replace("export default", "return"))();
  expect(validateBotModule(bot).valid).toBe(true);
  let intent: NavigationIntent | undefined;
  bot.decide(s, {
    navigate: (value: NavigationIntent) => {
      intent = value;
      return [];
    },
    status: () => ({ state: "idle" }),
  });
  if (!intent) throw new Error("Example did not choose a navigation intent");
  return intent;
}
it("expresses different visitor goals without implementing movement in the bots", () => {
  const s = fixture();
  s.coins = [{ id: "treasure", dx: -80, dy: -70, value: 30 }];
  expect(choose("sprinter", s)).toEqual({ target: { kind: "goal" } });
  expect(choose("collector", s)).toMatchObject({ target: { kind: "coin", id: "treasure" } });
  expect(choose("cautious", s)).toEqual({ target: { kind: "goal" }, caution: "careful" });
});

it("visitor route examples choose different offered movements for the same goal", () => {
  const options = [
    {
      id: "walk",
      kind: "walk",
      platformId: null,
      progress: 180,
      distance: 180,
      rise: 0,
      durationMs: 700,
      fruitValue: 0,
      crossesEnemy: false,
    },
    {
      id: "up",
      kind: "jump",
      platformId: "upper",
      progress: 160,
      distance: 160,
      rise: 100,
      durationMs: 900,
      fruitValue: 0,
      crossesEnemy: false,
    },
  ] as const;
  expect(choose("high-route", fixture())?.choose?.(options)).toBe("up");
  expect(choose("ground-route", fixture())?.choose?.(options)).toBe("walk");
});

it("the visitor agent's hopper favors short jumps but prioritizes crossing an enemy", () => {
  const moves = [
    {
      id: "long",
      kind: "jump",
      platformId: "floor",
      progress: 300,
      distance: 300,
      rise: 0,
      durationMs: 1200,
      fruitValue: 0,
      crossesEnemy: false,
    },
    {
      id: "short",
      kind: "jump",
      platformId: "floor",
      progress: 150,
      distance: 150,
      rise: 0,
      durationMs: 700,
      fruitValue: 0,
      crossesEnemy: false,
    },
  ] as const;
  const intent = choose("hopper", fixture());
  expect(intent?.choose?.(moves)).toBe("short");
  expect(intent?.choose?.([{ ...moves[0], crossesEnemy: true }, moves[1]])).toBe("long");
});
