// @vitest-environment node
import { readFileSync } from "node:fs";
import type {
  BotState,
  ChooseRoute,
  RouteOption,
  StrategyContext,
  ToolsApi,
} from "@arena/bot-contract";
import { checkStaticGuard, validateBotModule } from "@arena/bot-contract";
import { createNavigator } from "@arena/bot-navigation";
import { describe, expect, it } from "vitest";
import { createBotWorkerRuntime } from "../sandbox/botWorkerRuntime";

const root = new URL("../../../", import.meta.url);
const paths = [
  "client/src/bot/current-bot.template.js",
  "examples/strategies/sprinter.js",
  "examples/strategies/collector.js",
  "examples/strategies/cautious.js",
];

// Only repository-owned examples are evaluated here, never visitor input.
function load(source: string) {
  expect(checkStaticGuard(source).allowed).toBe(true);
  expect(Buffer.byteLength(source)).toBeLessThan(200_000);
  const bot = new Function(source.replace("export default", "return"))();
  expect(validateBotModule(bot).valid).toBe(true);
  expect(bot.apiVersion).toBe(1);
  expect(bot.frameworkVersion).toBe(1);
  expect(bot.name.trim().length).toBeGreaterThan(0);
  expect(bot.author.trim().length).toBeGreaterThan(0);
  return bot as { decide(state: BotState, tools: ToolsApi): string[] };
}

function state(): BotState {
  return {
    tick: 0,
    position: { x: 92, y: 284 },
    facing: "right",
    onGround: true,
    isAlive: true,
    velocity: { vx: 0, vy: 0 },
    isSprinting: false,
    sprintRampProgress: 0,
    nearbyTiles: [],
    platforms: [
      { id: "floor", dx: -92, dy: 16, width: 1000, height: 32, kind: "ground", collision: "solid" },
    ],
    tuning: {
      gravity: 900,
      tileSize: 16,
      tickMs: 33,
      baseMoveSpeed: 200,
      sprintMoveSpeed: 320,
      sprintRampMs: 450,
      baseJumpVelocity: -560,
      sprintJumpVelocity: -650,
      minJumpHoldMs: 180,
      botWidth: 24,
      botHeight: 32,
    },
    coins: [],
    hazards: [],
    utilities: [],
    nearestCoin: null,
    nearestHazard: null,
    nearestUtility: null,
    goalDirection: { dx: 858, dy: 0 },
    gapAhead: { present: false, distance: null },
    worldBounds: { width: 1200, height: 600 },
    justRespawned: false,
    tookDamage: false,
    coinsCollected: 0,
    livesRemaining: 3,
    timeElapsedMs: 0,
    navigation: {
      version: 1,
      epoch: 1,
      frame: 0,
      observedAtMs: 0,
      physicsStepMs: 1000 / 60,
      body: { x: 80, y: 268, width: 24, height: 32 },
      movement: { jumpStartedAtMs: null, impulseKind: "none", impulseAtMs: null, sourceId: null },
      viewport: { x: 0, y: 0, width: 1100, height: 600 },
      boingoJumpVelocity: -820,
      stompJumpVelocity: -280,
    },
  };
}

const context: StrategyContext = {
  timeElapsedMs: 0,
  timeRemainingMs: 90000,
  livesRemaining: 3,
  justRespawned: false,
  previousTargetId: null,
};

function option(
  id: string,
  kind: "goal" | "coin",
  route: Partial<RouteOption["route"]>
): RouteOption {
  return {
    id,
    target: {
      id: `target:${id}`,
      kind,
      position: { x: 200, y: 284 },
      value: kind === "coin" ? 10 : 0,
    },
    route: {
      id: `route:${id}`,
      estimatedDurationMs: 1000,
      detourPx: 0,
      expectedFruitValue: 0,
      goalProgressPx: 100,
      risk: 1,
      landingMarginPx: 20,
      mechanics: ["walk"],
      scope: kind === "coin" ? "target-reachable" : "local-progress",
      ...route,
    },
  };
}

const options = [
  option("fast", "goal", { goalProgressPx: 300, risk: 2 }),
  option("safe", "goal", { risk: 0, landingMarginPx: 80 }),
  option("fruit", "coin", { expectedFruitValue: 50, detourPx: 160 }),
];

function choose(path: string, offered = options, changes: Partial<StrategyContext> = {}) {
  const bot = load(readFileSync(new URL(path, root), "utf8"));
  let selected: string | null | undefined;
  const actions = ["sprint-left"] as const;
  const result = bot.decide(state(), {
    navigate(request) {
      expect(request?.choose).toBeTypeOf("function");
      selected = request?.choose?.({ ...context, ...changes }, offered);
      return [...actions];
    },
  });
  expect(result).toEqual(actions);
  return selected;
}

describe("single-file strategy artifacts", () => {
  it.each(paths)("%s is a small, named artifact that moves through the real runtime", (path) => {
    const source = readFileSync(new URL(path, root), "utf8");
    expect(source.split("\n").length).toBeLessThan(85);
    expect(source).not.toMatch(/predictPath|createJumpHold|createNavigator/);
    const bot = load(source);
    const runtime = createBotWorkerRuntime(createNavigator);
    expect(runtime.init(bot).type).toBe("module-ready");
    const result = runtime.tick({ type: "tick", tick: 0, stateTick: 0, epoch: 1, state: state() });
    expect(result.type).toBe("action");
    if (result.type === "action")
      expect(result.actions).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(sprint-)?right$/)])
      );
  });

  it("makes three distinct choices from the same options, independent of input order", () => {
    for (const offered of [options, [...options].reverse()]) {
      expect(choose(paths[0], offered)).toBe("fast");
      expect(choose(paths[1], offered)).toBe("fast");
      expect(choose(paths[2], offered)).toBe("fruit");
      expect(choose(paths[3], offered)).toBe("safe");
    }
  });

  it("collector ends detours at 65 seconds, with 25 seconds left, or on its last life", () => {
    expect(choose(paths[2], options, { timeElapsedMs: 64999, timeRemainingMs: 25001 })).toBe(
      "fruit"
    );
    for (const changes of [
      { timeElapsedMs: 65000 },
      { timeRemainingMs: 25000 },
      { livesRemaining: 1 },
    ]) {
      expect(choose(paths[2], options, changes)).toBe("fast");
    }
  });

  it("collector rejects excessive detours and unproven fruit routes", () => {
    const rejected = [
      option("far", "coin", { detourPx: 321, expectedFruitValue: 999 }),
      option("unproven", "coin", { scope: "local-progress", expectedFruitValue: 999 }),
    ];
    expect(choose(paths[2], [...options, ...rejected])).toBe("fruit");
    expect(choose(paths[2], [options[0], ...rejected])).toBe("fast");
  });

  it("collector ranks fruit value per additional time, not just highest value", () => {
    expect(
      choose(paths[2], [
        options[0],
        option("slow", "coin", {
          expectedFruitValue: 60,
          estimatedDurationMs: 6000,
          detourPx: 300,
        }),
        option("quick", "coin", {
          expectedFruitValue: 20,
          estimatedDurationMs: 1500,
          detourPx: 40,
        }),
      ])
    ).toBe("quick");
  });

  it("sprinter ranks progress per time rather than maximum distance", () => {
    expect(
      choose(paths[1], [
        option("far", "goal", { goalProgressPx: 500, estimatedDurationMs: 5000 }),
        option("quick", "goal", { goalProgressPx: 200, estimatedDurationMs: 500 }),
        option("fruit", "coin", { goalProgressPx: 9999, estimatedDurationMs: 1 }),
      ])
    ).toBe("quick");
  });

  it("cautious excludes planned stomps and prioritizes risk, then margin, then progress", () => {
    const stomp = option("stomp", "goal", { risk: 0, landingMarginPx: 999, mechanics: ["stomp"] });
    const narrow = option("narrow", "goal", { risk: 0, landingMarginPx: 40, goalProgressPx: 999 });
    const progress = option("progress", "goal", {
      risk: 0,
      landingMarginPx: 80,
      goalProgressPx: 200,
    });
    expect(choose(paths[3], [...options, stomp, narrow, progress])).toBe("progress");
  });

  it.each(paths)("%s uses stable IDs to break ties and returns null without options", (path) => {
    const tied = [option("b", "goal", {}), option("a", "goal", {})];
    expect(choose(path, tied)).toBe("a");
    expect(choose(path, [...tied].reverse())).toBe("a");
    expect(choose(path, [])).toBeNull();
  });

  it("collector actually selects fruit versus goal through runtime with time and lives from state", () => {
    const bot = load(readFileSync(new URL(paths[2], root), "utf8"));
    for (const [elapsed, lives, expected] of [
      [0, 3, "fruit"],
      [65000, 3, "goal"],
      [0, 1, "goal"],
    ] as const) {
      const navigator = createNavigator();
      const runtime = createBotWorkerRuntime(() => navigator);
      expect(runtime.init(bot).type).toBe("module-ready");
      const observation = state();
      observation.timeElapsedMs = elapsed;
      observation.livesRemaining = lives;
      observation.coins = [
        {
          id: "fruit",
          dx: 88,
          dy: 0,
          value: 50,
          bounds: { dx: 78, dy: -10, width: 20, height: 20 },
        },
      ];
      const result = runtime.tick({
        type: "tick",
        tick: 0,
        stateTick: 0,
        epoch: 1,
        state: observation,
      });
      expect(result.type).toBe("action");
      expect(navigator.getDiagnostics().targetId).toBe(expected);
    }
  });

  it("selects three different actual planner routes through the worker runtime", () => {
    const routes = paths.slice(1).map((path) => {
      const bot = load(readFileSync(new URL(path, root), "utf8"));
      const navigator = createNavigator();
      const runtime = createBotWorkerRuntime(() => navigator);
      expect(runtime.init(bot).type).toBe("module-ready");
      const observation = state();
      observation.coins = [
        {
          id: "fruit",
          dx: 88,
          dy: 0,
          value: 50,
          bounds: { dx: 78, dy: -10, width: 20, height: 20 },
        },
      ];
      expect(
        runtime.tick({ type: "tick", tick: 0, stateTick: 0, epoch: 1, state: observation }).type
      ).toBe("action");
      const diagnostic = navigator.getDiagnostics();
      expect(diagnostic.routeId).not.toBeNull();
      return diagnostic.routeId;
    });
    expect(new Set(routes).size).toBe(3);
  });
});

describe("visitor steering examples", () => {
  it.each([
    "docs/01-konzept.md",
    "docs/02-bot-api.md",
    "docs/03-architektur.md",
    "docs/04-devkcode-profil.md",
    "docs/06-level-design.md",
    "docs/09-bot-artefakt-und-turnier.md",
    "client/src/bot/AGENTS.md",
  ])("%s describes the existing preview without a separate test platform", (path) => {
    const text = readFileSync(new URL(path, root), "utf8");
    expect(text).not.toMatch(
      /bot:test|__bot-test|BOT_TEST_|evaluations\/|botTestPlugin|bot-test\.mjs|client\/src\/testing\/|SHA-256|Hashes|\b(?:Token|Authorization|Lease|Jobs)\b/i
    );
    expect(text).toContain("/code");
    expect(text).toContain("runs/");
  });

  it.each(["docs/02-bot-api.md", "docs/09-bot-artefakt-und-turnier.md"])(
    "%s documents an executable complete framework artifact",
    (path) => {
      const text = readFileSync(new URL(path, root), "utf8");
      const examples = [...text.matchAll(/```js\n([\s\S]*?)```/g)];
      expect(examples.length).toBeGreaterThan(0);
      for (const [, source] of examples) {
        const runtime = createBotWorkerRuntime(createNavigator);
        expect(runtime.init(load(source)).type).toBe("module-ready");
        const result = runtime.tick({
          type: "tick",
          tick: 0,
          stateTick: 0,
          epoch: 1,
          state: state(),
        });
        expect(result.type).toBe("action");
        if (result.type === "action") expect(result.actions).toContain("sprint-right");
      }
    }
  );

  it("contains short, executable tools examples instead of legacy motor control", () => {
    const text = readFileSync(new URL("client/src/bot/AGENTS.md", root), "utf8");
    expect(text.split("\n").length).toBeLessThan(180);
    const examples = [...text.matchAll(/```js\n([\s\S]*?)```/g)];
    expect(examples.length).toBeGreaterThan(0);
    for (const [, source] of examples) {
      const bot = load(source);
      let callback: ChooseRoute | undefined;
      bot.decide(state(), {
        navigate: (request) => {
          callback = request?.choose;
          return [];
        },
      });
      expect(callback?.(context, options)).toBe("fast");
      const runtime = createBotWorkerRuntime(createNavigator);
      expect(runtime.init(bot).type).toBe("module-ready");
      const result = runtime.tick({
        type: "tick",
        tick: 0,
        stateTick: 0,
        epoch: 1,
        state: state(),
      });
      expect(result.type).toBe("action");
      if (result.type === "action") expect(result.actions).toContain("sprint-right");
    }
  });
});
