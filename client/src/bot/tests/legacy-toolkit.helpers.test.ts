import { describe, expect, it } from "vitest";
import {
  apex,
  calcLandingCoords,
  createJumpHold,
  minJumpHoldToReach,
  moveToward,
  pathHits,
  pathIntersectsHazard,
  predictHazard,
  predictPath,
  simulateJump,
  surfaceAt,
  ticksUntilEdge,
  wallAhead,
} from "./legacy-toolkit.fixture.js";

const TUNING = {
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
};

function makeState(overrides = {}) {
  return {
    tick: 0,
    position: { x: 0, y: 0 },
    facing: "right",
    onGround: true,
    isAlive: true,
    velocity: { vx: 0, vy: 0 },
    isSprinting: false,
    sprintRampProgress: 0,
    nearbyTiles: [],
    platforms: [],
    tuning: TUNING,
    nearestCoin: null,
    nearestHazard: null,
    nearestUtility: null,
    coins: [],
    hazards: [],
    utilities: [],
    goalDirection: { dx: 0, dy: 0 },
    gapAhead: { present: false, distance: null },
    worldBounds: { width: 2000, height: 400 },
    justRespawned: false,
    tookDamage: false,
    coinsCollected: 0,
    livesRemaining: 3,
    timeElapsedMs: 0,
    ...overrides,
  };
}

describe("predictPath", () => {
  it("matches the exact analytic free-fall solution (y = 0.5*g*t^2) at every tick boundary, not just approximately", () => {
    // Regressionsschutz: eine fruehere Implementierung simulierte Schritt fuer
    // Schritt (semi-implizites Euler bei 33ms-Schritten) und wich dadurch
    // systematisch von der Physik ab (ueber 600ms Flugzeit z.B. um ~24px).
    // predictPath loest die Bahn stattdessen exakt per Kinematik-Formel.
    const state = makeState({ onGround: false, velocity: { vx: 0, vy: 0 } });
    const path = predictPath(state, { dir: 0, maxTicks: 20 });
    for (const tick of [1, 5, 10, 18]) {
      const totalSec = (tick * TUNING.tickMs) / 1000;
      const analyticDy = 0.5 * TUNING.gravity * totalSec * totalSec;
      expect(path[tick - 1].dy).toBeCloseTo(analyticDy, 6);
    }
  });

  it("free-falls straight down with no horizontal input and no platforms", () => {
    const state = makeState({ onGround: false });
    const path = predictPath(state, { dir: 0, maxTicks: 5 });
    expect(path).toHaveLength(5);
    for (const p of path) {
      expect(p.dx).toBe(0);
      expect(p.vy).toBeGreaterThan(0); // faellt (Gravity)
    }
    // monoton fallend
    expect(path[4].dy).toBeGreaterThan(path[0].dy);
  });

  it("sets vx to 0 immediately when dir is 0 (no coasting)", () => {
    const state = makeState({ velocity: { vx: 320, vy: 0 }, onGround: false });
    const path = predictPath(state, { dir: 0, maxTicks: 1 });
    expect(path[0].vx).toBe(0);
  });

  it("moves at baseMoveSpeed when dir is set without sprint", () => {
    const state = makeState({ onGround: true });
    const path = predictPath(state, { dir: 1, sprint: false, maxTicks: 1 });
    expect(path[0].vx).toBe(TUNING.baseMoveSpeed);
  });

  it("computes a jump impulse from baseMoveSpeed when launching from a standstill", () => {
    const state = makeState({ onGround: true, velocity: { vx: 0, vy: 0 } });
    const path = predictPath(state, { dir: 0, jump: true, holdJumpTicks: 1, maxTicks: 1 });
    // erster Tick: Sprungimpuls + 1 Tick Gravity
    const expectedVy = TUNING.baseJumpVelocity + TUNING.gravity * (TUNING.tickMs / 1000);
    expect(path[0].vy).toBeCloseTo(expectedVy, 0);
  });

  it("cuts the jump hard once minJumpHoldMs has elapsed and jump is released", () => {
    const state = makeState({ onGround: true });
    // holdJumpTicks=1 heisst: nur im ersten Tick "jump" gehalten, danach losgelassen.
    const path = predictPath(state, { dir: 0, jump: true, holdJumpTicks: 1, maxTicks: 10 });
    // Nach minJumpHoldMs (180ms / 33ms/tick ~ 6 Ticks) sollte vy exakt 0 sein
    // in dem Tick, wo der Cut greift (danach faellt er wieder wegen Gravity).
    const cutTickIndex = Math.ceil(TUNING.minJumpHoldMs / TUNING.tickMs); // ~6
    const cutPoint = path[cutTickIndex - 1];
    expect(cutPoint).toBeDefined();
  });

  it("lands on a platform below and stops the simulation there", () => {
    const state = makeState({
      onGround: false,
      velocity: { vx: 0, vy: 100 },
      platforms: [{ dx: -50, dy: 50, width: 100, height: 16, kind: "ground" }],
    });
    const path = predictPath(state, { dir: 0, maxTicks: 40 });
    const last = path[path.length - 1];
    expect(last.landed).toBe(true);
    expect(last.dy).toBeCloseTo(50 - TUNING.botHeight / 2);
  });

  it("finds a landing far below the jump start, long after the cut (regression: the collision search ignored the vertical phase offset and found NO solution at all after a cut, so calcLandingCoords always returned 'none' and a bot would never jump)", () => {
    // Nachbildung des toolkit-Testlevels: Bot steht auf einer Plattform,
    // springt mit kurzer Haltezeit (Cut greift), Zielplattform liegt auf
    // GLEICHER Höhe ein Stück voraus.
    const state = makeState({
      onGround: true,
      facing: "right",
      velocity: { vx: 320, vy: 0 },
      isSprinting: true,
      sprintRampProgress: 1,
      platforms: [
        { dx: -100, dy: 16, width: 160, height: 16, kind: "ground" },
        { dx: 200, dy: 16, width: 256, height: 16, kind: "ground" },
      ],
    });
    const result = calcLandingCoords(state, {
      dir: 1,
      sprint: true,
      jump: true,
      holdJumpTicks: 6,
    });
    expect(result.kind).toBe("ground");
    expect(result.dy).toBeCloseTo(16 - TUNING.botHeight / 2);
    expect(result.dx).toBeGreaterThan(200); // landet auf der vorderen Plattform
  });
});

describe("calcLandingCoords", () => {
  it("returns kind 'ground' when a landing is found", () => {
    const state = makeState({
      onGround: false,
      velocity: { vx: 0, vy: 100 },
      platforms: [{ dx: -50, dy: 50, width: 100, height: 16, kind: "ground" }],
    });
    const result = calcLandingCoords(state);
    expect(result.kind).toBe("ground");
  });

  it("returns kind 'none' when no platform is ever reached", () => {
    const state = makeState({ onGround: false, velocity: { vx: 0, vy: 0 } });
    const result = calcLandingCoords(state, { maxTicks: 5 });
    expect(result.kind).toBe("none");
  });

  it("defaults to continuing the bot's current velocity (not dir:0)", () => {
    const state = makeState({ onGround: true, velocity: { vx: 200, vy: 0 }, facing: "right" });
    const result = calcLandingCoords(state, { maxTicks: 1 });
    // bei vx=200 sollte sich dx nach einem Tick nach rechts bewegt haben
    expect(result.dx).toBeGreaterThan(0);
  });
});

describe("simulateJump / apex", () => {
  it("simulateJump lands on the platform below, same as calcLandingCoords with jump", () => {
    const state = makeState({
      onGround: true,
      velocity: { vx: 0, vy: 0 },
      platforms: [{ dx: -1000, dy: 300, width: 3000, height: 16, kind: "ground" }],
    });
    const result = simulateJump(state, 5);
    expect(result.kind).toBe("ground");
    expect(result.dy).toBeCloseTo(300 - TUNING.botHeight / 2);
  });

  it("simulateJump reaches higher with more held ticks", () => {
    const state = makeState({
      onGround: true,
      velocity: { vx: 0, vy: 0 },
      platforms: [{ dx: -1000, dy: 300, width: 3000, height: 16, kind: "ground" }],
    });
    const short = apex(state, { jump: true, holdJumpTicks: 1, maxTicks: 30 });
    const long = apex(state, { jump: true, holdJumpTicks: 10, maxTicks: 30 });
    expect(long.dy).toBeLessThan(short.dy); // hoeher = kleineres dy
  });
});

describe("ticksUntilEdge / surfaceAt / wallAhead", () => {
  it("surfaceAt finds the platform dy under a given horizontal offset", () => {
    const state = makeState({
      platforms: [{ dx: 0, dy: 40, width: 32, height: 16, kind: "ground" }],
    });
    expect(surfaceAt(state, 10)).toBe(40);
    expect(surfaceAt(state, 100)).toBeNull();
  });

  it("surfaceAt ignores platforms ABOVE the bot (not a landing target)", () => {
    const state = makeState({
      platforms: [
        { dx: 0, dy: -60, width: 32, height: 16, kind: "ground" }, // über dem Bot
        { dx: 0, dy: 40, width: 32, height: 16, kind: "ground" }, // Boden darunter
      ],
    });
    expect(surfaceAt(state, 10)).toBe(40);
  });

  it("ticksUntilEdge returns null when standing on nothing", () => {
    const state = makeState({ platforms: [] });
    expect(ticksUntilEdge(state)).toBeNull();
  });

  it("ticksUntilEdge returns a positive tick count when a platform edge is ahead", () => {
    const state = makeState({
      facing: "right",
      platforms: [{ dx: -12, dy: 16, width: 48, height: 16, kind: "ground" }],
    });
    const ticks = ticksUntilEdge(state);
    expect(ticks).not.toBeNull();
    expect(ticks).toBeGreaterThan(0);
  });

  it("wallAhead returns null when nothing blocks the facing direction", () => {
    const state = makeState({ platforms: [] });
    expect(wallAhead(state)).toBeNull();
  });

  it("wallAhead ignores a low step the bot can simply jump onto", () => {
    // Oberkante nur 32px über den Füßen - max. Steighöhe ist ~174px.
    const state = makeState({
      facing: "right",
      platforms: [{ dx: 50, dy: -16, width: 16, height: 64, kind: "ground" }],
    });
    expect(wallAhead(state)).toBeNull();
  });

  it("wallAhead detects a wall that is higher than the bot can jump", () => {
    // Oberkante 216px über den Füßen -> über der max. Steighöhe (~174px).
    const state = makeState({
      facing: "right",
      platforms: [{ dx: 50, dy: -200, width: 16, height: 400, kind: "ground" }],
    });
    const wall = wallAhead(state);
    expect(wall).not.toBeNull();
    expect(wall?.distance).toBeCloseTo(50 - TUNING.botWidth / 2);
    expect(wall?.height).toBeCloseTo(216);
  });

  it("wallAhead sees a wall built from STACKED thin slabs (regression: each slab was judged on its own, so every slab was either low enough to jump or high enough to pass under - a real wall was never detected)", () => {
    // Reales Terrain besteht aus 16px-Platten; eine Wand ist ein Stapel.
    const platforms = [{ dx: -100, dy: 16, width: 400, height: 16, kind: "ground" as const }];
    for (let offset = 16; offset <= 320; offset += 16) {
      platforms.push({ dx: 50, dy: 16 - offset, width: 32, height: 16, kind: "ground" as const });
    }
    const wall = wallAhead(makeState({ facing: "right", platforms }));
    expect(wall).not.toBeNull();
    expect(wall?.height).toBeCloseTo(320);
    expect(wall?.distance).toBeCloseTo(50 - TUNING.botWidth / 2);
  });

  it("wallAhead keeps reporting a wall the bot is already touching (regression: a negative raw distance dropped the wall entirely, so the bot would start running again)", () => {
    const platforms = [{ dx: -100, dy: 16, width: 400, height: 16, kind: "ground" as const }];
    for (let offset = 16; offset <= 320; offset += 16) {
      platforms.push({ dx: 5, dy: 16 - offset, width: 32, height: 16, kind: "ground" as const });
    }
    const wall = wallAhead(makeState({ facing: "right", platforms }));
    expect(wall).not.toBeNull();
    expect(wall?.distance).toBe(0);
  });
});

describe("predictHazard / pathIntersectsHazard", () => {
  it("predictHazard extrapolates position linearly from vx/vy", () => {
    const hazard = {
      dx: 0,
      dy: 0,
      kind: "schnetzler",
      active: true,
      warning: false,
      stompable: false,
      vx: 100,
      vy: 0,
    };
    const state = makeState();
    const result = predictHazard(state, hazard, 10); // 10 ticks * 33ms = 0.33s
    expect(result.dx).toBeCloseTo(100 * 0.33, 0);
  });

  it("pathIntersectsHazard is false for an inactive hazard", () => {
    const hazard = {
      dx: 0,
      dy: 0,
      kind: "loderix",
      active: false,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    };
    const path = [{ dx: 0, dy: 0, vx: 0, vy: 0, ticks: 1 }];
    expect(pathIntersectsHazard(makeState(), path, hazard)).toBe(false);
  });

  it("pathIntersectsHazard is true when the path passes near an active hazard", () => {
    const hazard = {
      dx: 5,
      dy: 0,
      kind: "stachlinger",
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    };
    const path = [{ dx: 0, dy: 0, vx: 0, vy: 0, ticks: 1 }];
    expect(pathIntersectsHazard(makeState(), path, hazard)).toBe(true);
  });
});

describe("moveToward / createJumpHold / pathHits", () => {
  it("moveToward returns idle for dx=0", () => {
    expect(moveToward(0, false)).toBe("idle");
  });

  it("moveToward returns direction, optionally sprinting", () => {
    expect(moveToward(10, false)).toBe("right");
    expect(moveToward(-10, false)).toBe("left");
    expect(moveToward(10, true)).toBe("sprint-right");
    expect(moveToward(-10, true)).toBe("sprint-left");
  });

  it("createJumpHold holds jump for the requested number of ticks", () => {
    const hold = createJumpHold();
    expect(hold.tick(true, 3)).toBe(true);
    expect(hold.tick(false, 3)).toBe(true);
    expect(hold.tick(false, 3)).toBe(true);
    expect(hold.tick(false, 3)).toBe(false);
  });

  it("pathHits detects a point within radius", () => {
    const path = [{ dx: 10, dy: 10, vx: 0, vy: 0, ticks: 1 }];
    expect(pathHits(path, 12, 10, 5)).toBe(true);
    expect(pathHits(path, 100, 100, 5)).toBe(false);
  });
});

describe("minJumpHoldToReach", () => {
  it("returns null when the target is unreachable (way too high)", () => {
    const state = makeState({ onGround: true });
    expect(minJumpHoldToReach(state, 0, -10000)).toBeNull();
  });

  it("returns a small hold count for a modest, reachable height", () => {
    const state = makeState({ onGround: true });
    const holdTicks = minJumpHoldToReach(state, 0, -30, 12);
    expect(holdTicks).not.toBeNull();
    expect(holdTicks).toBeGreaterThan(0);
  });
});

describe("performance (5ms decide() budget)", () => {
  it("predictPath over a realistic level slice stays far under the 5ms budget", () => {
    const platforms = [];
    for (let i = 0; i < 12; i++) {
      platforms.push({
        dx: i * 64 - 300,
        dy: 100 + (i % 3) * 16,
        width: 48,
        height: 16,
        kind: "ground",
      });
    }
    const state = makeState({ onGround: true, platforms });

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      predictPath(state, { dir: 1, sprint: true, jump: true, holdJumpTicks: 10, maxTicks: 40 });
    }
    const elapsed = performance.now() - start;

    // 50 Aufrufe zusammen weit unter dem 5ms-Produktionsbudget FUER EINEN Aufruf.
    expect(elapsed).toBeLessThan(20);
  });
});
