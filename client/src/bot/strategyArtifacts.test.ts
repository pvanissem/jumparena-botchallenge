// @vitest-environment node
import { readFileSync } from "node:fs";
import type { BotState, ControlCommand, ControlStatus, ToolsApi } from "@arena/bot-contract";
import { checkStaticGuard, validateBotModule } from "@arena/bot-contract";
import { createMovementController } from "@arena/bot-navigation";
import { describe, expect, it } from "vitest";
import { LEVEL_ONE } from "../game/level/levelOne";
import { createBotWorkerRuntime } from "../sandbox/botWorkerRuntime";

const root = new URL("../../../", import.meta.url);
const paths = [
  "examples/experimental/sprinter.js",
  "examples/experimental/collector.js",
  "examples/experimental/cautious.js",
  "examples/experimental/visitor-builder.js",
];
function load(path: string, replace?: [string, string]) {
  let source = readFileSync(new URL(path, root), "utf8");
  if (replace) source = source.replace(...replace);
  expect(checkStaticGuard(source).allowed).toBe(true);
  const bot = new Function(source.replace("export default", "return"))();
  expect(validateBotModule(bot).valid).toBe(true);
  expect(bot.frameworkVersion).toBe(2);
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

function observe(
  bot: ReturnType<typeof load>,
  input = state(),
  status: Partial<ControlStatus> = {}
): { command: ControlCommand | null; result: string[] } {
  let command: ControlCommand | null = null;
  const result = bot.decide(input, {
    options: () => {
      throw new Error("Legacy example unexpectedly calls options");
    },
    status: () => ({ commandId: null, state: "idle", phase: null, reason: null, ...status }),
    run: (next) => {
      command = next;
      return ["right"];
    },
  });
  return { command, result };
}
function passage() {
  const input = state();
  input.platforms.push({
    id: "upper",
    dx: 158,
    dy: -184,
    width: 240,
    height: 16,
    kind: "float",
    collision: "one-way-up",
  });
  input.utilities = [{ id: "spring", kind: "boingo", dx: 88, dy: 11 }];
  return input;
}
describe("v2 visitor-owned strategy artifacts", () => {
  it.each(paths)("%s chooses a concrete walking goal without a planner", (path) => {
    const result = observe(load(path));
    expect(result.command).toMatchObject({ kind: "walk", x: 950 });
    expect(result.result).toEqual(["right"]);
  });
  it.each(paths)("%s executes with the actual worker runtime and controller", (path) => {
    const runtime = createBotWorkerRuntime(createMovementController);
    expect(runtime.init(load(path)).type).toBe("module-ready");
    const result = runtime.tick({ type: "tick", tick: 0, stateTick: 0, epoch: 1, state: state() });
    expect(result).toMatchObject({ type: "action" });
    if (result.type === "action")
      expect(result.actions).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(sprint-)?right$/)])
      );
  });
  it("waits for spawn ground contact without consuming its first walking command", () => {
    const bot = load("examples/experimental/visitor-builder.js");
    expect(observe(bot, { ...state(), onGround: false })).toEqual({ command: null, result: [] });
    expect(observe(bot).command).toMatchObject({ kind: "walk" });
  });
  it.each([48, 1000])(
    "jumps across an observed gap onto a %i px platform near its front edge",
    (width) => {
      const input = state();
      input.platforms[0].width = 120;
      input.platforms.push({
        id: "next",
        dx: 88,
        dy: 16,
        width,
        height: 16,
        kind: "float",
        collision: "one-way-up",
      });
      input.gapAhead = { present: true, distance: 16 };
      expect(
        observe(load("examples/experimental/visitor-builder.js"), input).command
      ).toMatchObject({
        kind: "jump",
        platformId: "next",
        x: 200,
      });
    }
  );
  it("walks again from the landed platform after a previous edge stopped walking", () => {
    const bot = load("examples/experimental/visitor-builder.js");
    const first = observe(bot).command;
    const edge = state();
    edge.platforms[0].width = 120;
    edge.platforms.push({
      id: "next",
      dx: 88,
      dy: 16,
      width: 1000,
      height: 16,
      kind: "ground",
      collision: "solid",
    });
    edge.gapAhead = { present: true, distance: 16 };
    const jump = observe(bot, edge, { state: "failed", commandId: first?.id }).command;
    expect(jump).toMatchObject({ kind: "jump", platformId: "next" });
    const landed = state();
    landed.position.x = 220;
    if (landed.navigation) landed.navigation.body.x = 208;
    landed.platforms = [
      { id: "next", dx: -40, dy: 16, width: 1000, height: 16, kind: "ground", collision: "solid" },
    ];
    const walk = observe(bot, landed, { state: "succeeded", commandId: jump?.id }).command;
    expect(walk).toMatchObject({ kind: "walk" });
    expect(walk?.id).not.toBe(first?.id);
  });
  it("lets an editable rule choose boingo versus jump for the same landing", () => {
    const path = "examples/experimental/visitor-builder.js";
    expect(observe(load(path), passage()).command).toMatchObject({
      kind: "boingo",
      utilityId: "spring",
      platformId: "upper",
    });
    expect(
      observe(load(path, ["useBoingo: true", "useBoingo: false"]), passage()).command
    ).toMatchObject({ kind: "jump", platformId: "upper" });
  });
  it("keeps the same running command despite a newly visible target", () => {
    const bot = load("examples/experimental/visitor-builder.js");
    const first = observe(bot, passage()).command;
    const changed = passage();
    changed.utilities = [];
    expect(observe(bot, changed, { state: "running", commandId: first?.id }).command).toEqual(
      first
    );
  });
  it("does not repeat a failed maneuver and clears visitor memory on respawn", () => {
    const bot = load("examples/experimental/visitor-builder.js");
    const first = observe(bot, passage()).command;
    const second = observe(bot, passage(), { state: "failed", commandId: first?.id });
    expect(second.command?.id).not.toBe(first?.id);
    expect(observe(bot, { ...passage(), justRespawned: true }).command).toEqual(first);
  });
  it("collector chooses a nearby fruit until the endspurt while sprinter keeps the goal", () => {
    const input = state();
    input.coins = [{ id: "fruit", dx: 60, dy: 0, value: 15 }];
    expect(observe(load("examples/experimental/collector.js"), input).command).toMatchObject({
      kind: "walk",
      x: 152,
    });
    expect(observe(load("examples/experimental/sprinter.js"), input).command).toMatchObject({
      kind: "walk",
      x: 950,
    });
    expect(
      observe(load("examples/experimental/collector.js"), { ...input, timeElapsedMs: 65000 })
        .command
    ).toMatchObject({ kind: "walk", x: 950 });
  });
  it("cautious waits when a nearby active hazard blocks its direction", () => {
    const input = state();
    input.hazards = [
      {
        dx: 40,
        dy: 0,
        kind: "stachlinger",
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    expect(observe(load("examples/experimental/cautious.js"), input)).toEqual({
      command: null,
      result: [],
    });
  });
});

describe.each(["examples/strategies/messe-demo.js"])("explicit Level 1 route: %s", (path) => {
  it("walks to the first launch and then chooses the real narrow F1", () => {
    const bot = load(path);
    const first = observe(bot).command;
    expect(first).toMatchObject({ kind: "walk", x: 200 });
    expect(
      observe(bot, state(), { state: "succeeded", commandId: first?.id }).command
    ).toMatchObject({ kind: "jump", platformId: "level-one:platform:8", x: 360 });
  });
  it.each([
    [1470, "jump", 1490],
    [2240, "walk", 2500],
    [3504, "jump", 3600],
    [3952, "jump", 4160],
    [4368, "jump", 4400],
    [4816, "walk", 5160],
    [5450, "walk", 5420],
    [7232, "walk", 7792],
  ])("resumes checkpoint x=%i with %s to %i", (x, kind, targetX) => {
    const input = state();
    input.position.x = Number(x);
    expect(observe(load(path), input).command).toMatchObject({ kind, x: targetX });
  });
  it("uses the first spring to stay above the two fires until a clear landing", () => {
    const input = state();
    input.position.x = 1470;
    const bot = load(path);
    const first = observe(bot, input).command;
    expect(observe(bot, input, { state: "succeeded", commandId: first?.id }).command).toMatchObject(
      {
        kind: "boingo",
        utilityId: "boingo-1",
        platformId: "level-one:platform:5",
        x: 2070,
      }
    );
  });
  it("keeps checkpoint entry stable when a visitor inserts an earlier route step", () => {
    const input = state();
    input.position.x = 1470;
    const bot = load(path, ["jump(8, 360),", "jump(8, 360), walk(370),"]);
    expect(observe(bot, input).command).toMatchObject({ kind: "jump", x: 1490 });
  });
  it("waits for ground and a 600ms pause before retrying a failed command with one new ID", () => {
    const bot = load(path);
    const first = observe(bot).command;
    const failed = { state: "failed" as const, commandId: first?.id };
    expect(observe(bot, state(), failed).command).toBeNull();
    expect(
      observe(bot, { ...state(), timeElapsedMs: 700, onGround: false }, failed).command
    ).toBeNull();
    const retry = observe(bot, { ...state(), timeElapsedMs: 800 }, failed).command;
    expect(retry).toMatchObject({ kind: "walk", x: 200 });
    expect(retry?.id).not.toBe(first?.id);
    expect(observe(bot, { ...state(), timeElapsedMs: 833 }, failed).command).toEqual(retry);
  });
  it("waits for a witnessed active-to-inactive Loderix edge before normal-speed crossing", () => {
    const bot = load(path);
    const input = state();
    input.position.x = 5450;
    const first = observe(bot, input).command;
    const complete = { state: "succeeded" as const, commandId: first?.id };
    input.hazards = [
      {
        id: "loderix-3",
        dx: 20,
        dy: 0,
        kind: "loderix",
        active: false,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    expect(observe(bot, input, complete).command).toBeNull();
    input.hazards[0].active = true;
    expect(observe(bot, input).command).toBeNull();
    input.hazards[0].active = false;
    expect(observe(bot, input).command).toMatchObject({ kind: "walk", x: 5900, sprint: false });
  });
  it("keeps every prescribed jump landing inside an existing Level 1 platform", () => {
    const bot = load(path);
    let previous: ControlCommand | null = null;
    const input = state();
    input.hazards = [
      {
        id: "loderix-3",
        dx: 0,
        dy: 0,
        kind: "loderix",
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    let count = 0;
    for (let i = 0; i < 40; i++) {
      let command: ControlCommand | null = observe(
        bot,
        input,
        previous ? { state: "succeeded", commandId: previous.id } : {}
      ).command;
      if (!command) {
        input.hazards[0].active = false;
        command = observe(bot, input).command;
      }
      if (!command) break;
      if (command.kind === "jump" && command.platformId === "level-one:platform:15") {
        const block = LEVEL_ONE.hiddenCoinBlocks.find((block) => block.id === "block-5");
        expect(previous?.x).toBeLessThanOrEqual((block?.x ?? 0) - 50);
      }
      if (command.kind !== "walk") {
        const platform = LEVEL_ONE.platforms[Number(command.platformId.split(":").at(-1))];
        expect(platform).toBeDefined();
        expect(command.x).toBeGreaterThan(platform.x);
        expect(command.x).toBeLessThan(platform.x + platform.tilesWide * 16);
        if (command.kind === "boingo")
          expect(LEVEL_ONE.utilities.some((u) => u.id === command.utilityId)).toBe(true);
      }
      previous = command;
      count++;
    }
    expect(count).toBe(31);
    expect(previous).toMatchObject({ kind: "walk", x: 7792 });
  });
});

describe("fresh visitor template", () => {
  it("supports selecting an offer, keeping its command and resetting on respawn", () => {
    const bot = load("client/src/bot/current-bot.template.js", [
      "return null;",
      "return options.sort((a, b) => score(b) - score(a))[0] ?? null;",
    ]);
    const input = state();
    const first: ControlCommand = { id: "first", kind: "walk", x: 300 };
    const other: ControlCommand = { id: "other", kind: "walk", x: 500 };
    let available = [{ command: first, progress: 200, fruitValue: 0, durationMs: 500 }];
    let status: ControlStatus = { commandId: null, state: "idle", phase: null, reason: null };
    let chosen: ControlCommand | null = null;
    const tools: ToolsApi = {
      options: () => available,
      status: () => status,
      run: (c) => {
        chosen = c;
        return ["right"];
      },
    };
    expect(bot.decide(input, tools)).toEqual(["right"]);
    expect(chosen).toBe(first);
    status = { commandId: first.id, state: "running", phase: "approach", reason: null };
    available = [{ command: other, progress: 400, fruitValue: 0, durationMs: 500 }];
    bot.decide(input, tools);
    expect(chosen).toBe(first);
    available = [];
    chosen = null;
    expect(bot.decide({ ...input, justRespawned: true }, tools)).toEqual([]);
    expect(chosen).toBeNull();
  });

  it("returns no actions and starts no movement, including after respawn", () => {
    const bot = load("client/src/bot/current-bot.template.js");
    for (const input of [state(), passage(), { ...state(), justRespawned: true }]) {
      const controller = createMovementController();
      expect(
        bot.decide(input, {
          options: () => controller.options(input),
          status: () => controller.status(input),
          run: () => {
            throw new Error("Fresh template must not start a command");
          },
        })
      ).toEqual([]);
    }
  });
});

describe("visitor example hazard handling", () => {
  const path = "examples/experimental/visitor-builder.js";
  function danger(input: BotState) {
    input.hazards = [
      {
        kind: "kugelblitz",
        dx: 80,
        dy: -50,
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    return input;
  }
  it("waits before a new jump even when a nearby hazard is at its turning point", () => {
    const bot = load(path);
    expect(observe(bot, danger(passage()))).toEqual({ command: null, result: [] });
    expect(observe(bot, passage()).command).toMatchObject({ kind: "boingo" });
  });
  it("retries a temporarily blocked walk with a fresh ID after the hazard leaves", () => {
    const bot = load(path);
    const first = observe(bot).command;
    expect(
      observe(bot, danger(state()), {
        state: "failed",
        reason: "danger-ahead",
        commandId: first?.id,
      })
    ).toEqual({ command: null, result: [] });
    const retry = observe(bot).command;
    expect(retry).toMatchObject({ kind: "walk", x: 950 });
    expect(retry?.id).not.toBe(first?.id);
  });
});

describe("editable environment strategy", () => {
  it("visitor fruit weighting changes the chosen movement", () => {
    const path = "examples/strategies/visitor-builder.js";
    const options = [
      {
        command: { id: "direct", kind: "walk" as const, x: 500 },
        progress: 400,
        fruitValue: 0,
        durationMs: 1000,
      },
      {
        command: { id: "bonus", kind: "walk" as const, x: 300 },
        progress: 200,
        fruitValue: 30,
        durationMs: 1000,
      },
    ];
    function chosen(bot: ReturnType<typeof load>) {
      let id: string | null = null;
      bot.decide(state(), {
        options: () => options,
        status: () => ({ commandId: null, state: "idle", phase: null, reason: null }),
        run: (c) => {
          id = c.id;
          return [];
        },
      });
      return id;
    }
    expect(chosen(load(path))).toBe("direct");
    expect(chosen(load(path, ["fruit: 0.15", "fruit: 2"]))).toBe("bonus");
  });
  it.each(["visitor-builder", "sprinter", "collector"])(
    "%s works through the actual worker with arbitrary platform IDs",
    (name) => {
      const runtime = createBotWorkerRuntime(createMovementController);
      expect(runtime.init(load(`examples/strategies/${name}.js`)).type).toBe("module-ready");
      expect(
        runtime.tick({ type: "tick", tick: 0, stateTick: 0, epoch: 1, state: state() })
      ).toMatchObject({ type: "action", actions: expect.arrayContaining(["sprint-right"]) });
    }
  );
});

it("visitor waits for an observed fire opening before walking through it", () => {
  const bot = load("examples/strategies/visitor-builder.js"),
    input = state();
  input.platforms.push({
    id: "ceiling",
    dx: -92,
    dy: -48,
    width: 1000,
    height: 16,
    kind: "ceiling",
    collision: "solid",
  });
  input.hazards = [
    {
      id: "fire",
      kind: "loderix",
      dx: 40,
      dy: 0,
      bounds: { dx: 34, dy: -10, width: 12, height: 26 },
      active: false,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    },
  ];
  function decide() {
    let selected: ControlCommand | null = null;
    const c = createMovementController();
    bot.decide(input, {
      options: () => c.options(input),
      status: () => c.status(input),
      run: (cmd) => {
        selected = cmd;
        return [];
      },
    });
    return selected;
  }
  expect(decide()).toBeNull();
  input.hazards[0].active = true;
  input.timeElapsedMs = 100;
  decide();
  input.hazards[0].active = false;
  input.timeElapsedMs = 1500;
  expect(decide()).toMatchObject({ kind: "walk" });
});
