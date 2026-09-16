import type { BotState } from "@arena/bot-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixture, platform } from "./fixtures";
import { createNavigator } from "./index";
import * as planner from "./planner";

function next(state: BotState, ms = 33) {
  state.tick++;
  state.timeElapsedMs += ms;
  state.navigation!.frame += Math.round(ms / state.navigation!.physicsStepMs);
  state.navigation!.observedAtMs += ms;
}

function blockedFixture() {
  const state = fixture();
  state.hazards = [
    {
      id: "spikes",
      kind: "stachlinger",
      dx: 100,
      dy: 280,
      bounds: { dx: 80, dy: -500, width: 1000, height: 1000 },
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    },
  ];
  return state;
}

afterEach(() => vi.restoreAllMocks());

describe("negative navigation cache", () => {
  it.each(["inactive", "warning-ended", "disappeared", "moved"])(
    "retries a completed empty search after the blocker is %s",
    (change) => {
      const state = blockedFixture();
      if (change === "warning-ended") {
        state.hazards[0].active = false;
        state.hazards[0].warning = true;
      }
      const blocked = planner.planRoutes(state);
      expect(blocked.resume).toBeUndefined();
      expect(blocked.options).toEqual([]);
      const nav = createNavigator();
      expect(nav.decide(state)).toEqual(["idle"]);
      expect(nav.getDiagnostics().reason).toBe("no-known-continuation");

      if (change === "inactive") state.hazards[0].active = false;
      if (change === "warning-ended") state.hazards[0].warning = false;
      if (change === "disappeared") state.hazards = [];
      if (change === "moved") state.hazards[0].bounds!.dx = 1100;
      expect(planner.planRoutes(state).options.length).toBeGreaterThan(0);
      next(state, 2999);
      expect(nav.decide(state)).toEqual(["idle"]);
      next(state, 1);
      expect(nav.decide(state)).not.toEqual(["idle"]);
      expect(nav.getDiagnostics().phase).toBe("execute");
    }
  );

  it("does not repeat a completed search without changed hazards", () => {
    const state = blockedFixture();
    const search = vi.spyOn(planner, "planRoutes");
    const nav = createNavigator();
    nav.decide(state);
    for (let i = 0; i < 4; i++) {
      next(state, 3000);
      expect(nav.decide(state)).toEqual(["idle"]);
    }
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("replans finished nonempty options when changed hazards filter every cached route", () => {
    const state = fixture();
    const routes = planner.planRoutes(state);
    const walk = routes.options.find((option) =>
      routes.plans.get(option.id)!.every((leg) => !leg.maneuver.jump)
    )!;
    expect(walk).toBeDefined();
    const finished = {
      options: [walk],
      plans: new Map([[walk.id, routes.plans.get(walk.id)!]]),
      stats: { ...routes.stats, status: "complete" as const },
    };
    const resume = vi.fn(() => finished);
    const search = vi.spyOn(planner, "planRoutes").mockReturnValueOnce({
      ...finished,
      options: [],
      resume,
    });
    const nav = createNavigator();
    const choose = vi.fn(() => null);
    nav.decide(state, choose);
    expect(nav.getDiagnostics().phase).toBe("wait");
    state.hazards = blockedFixture().hazards;
    state.hazards[0].bounds = { dx: 200, dy: 268, width: 24, height: 32 };
    next(state);
    expect(nav.decide(state, choose)).toEqual(["idle"]);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(choose).not.toHaveBeenCalled();
    expect(nav.getDiagnostics().reason).toBe("no-known-continuation");

    const fresh = planner.planRoutes(state);
    for (let i = 0; i < 15 && fresh.resume && !fresh.options.length; i++) fresh.resume();
    expect(fresh.options.length).toBeGreaterThan(0);
    search.mockClear();
    next(state, 3000);
    nav.decide(state, choose);
    for (let i = 0; i < 15 && nav.getDiagnostics().phase === "wait"; i++) {
      next(state);
      nav.decide(state, choose);
    }
    expect(search).toHaveBeenCalledTimes(1);
    expect(choose).toHaveBeenCalledTimes(1);
    expect(nav.getDiagnostics().phase).toBe("execute");
  });

  it("bounds retries under continuous movement and never bypasses hazard safety", () => {
    const state = blockedFixture();
    const search = vi.spyOn(planner, "planRoutes");
    const choose = vi.fn(() => null);
    const nav = createNavigator();
    nav.decide(state, choose);
    for (let i = 1; i <= 90; i++) {
      next(state, 100);
      state.hazards[0].bounds!.dy += 0.1;
      expect(nav.decide(state, choose)).toEqual(["idle"]);
      expect(search).toHaveBeenCalledTimes(1 + Math.floor(i / 30));
    }
    expect(choose).not.toHaveBeenCalled();
  });

  it("preserves a pending search and its deadline when actors move every tick", () => {
    const state = fixture();
    state.platforms = [platform("last", 0, 300, 110)];
    state.navigation!.physicsStepMs = 0.1;
    state.hazards = blockedFixture().hazards;
    state.hazards[0].bounds!.dx = 1100;
    const search = vi.spyOn(planner, "planRoutes");
    const nav = createNavigator();
    nav.decide(state);
    expect(nav.getDiagnostics().phase).toBe("wait");
    for (let i = 1; i <= 16; i++) {
      next(state);
      state.hazards[0].bounds!.dx++;
      expect(nav.decide(state)).toEqual(["idle"]);
    }
    expect(search).toHaveBeenCalledTimes(1);
    expect(nav.getDiagnostics().reason).toBe("planning-deadline");
    next(state, 2999);
    nav.decide(state);
    expect(search).toHaveBeenCalledTimes(1);
    next(state, 1);
    nav.decide(state);
    expect(search).toHaveBeenCalledTimes(2);
    expect(nav.getDiagnostics().phase).toBe("wait");
  });
});
