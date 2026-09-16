import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { createNavigator } from "./index";
import { planRoutes } from "./planner";

it("reports local planning latency without claiming a worker/browser budget", () => {
  const s = fixture();
  s.coins = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    dx: 160 + i * 30,
    dy: 150,
    value: 10,
    bounds: { dx: 150 + i * 30, dy: 140, width: 20, height: 20 },
  }));
  s.platforms.push(platform("ledge", 220, 210, 250, 16, "one-way-up"));
  const navigator = createNavigator();
  const coldStart = performance.now();
  navigator.decide(s);
  const coldDecideMs = performance.now() - coldStart;
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const result = planRoutes(s);
    const elapsed = performance.now() - start;
    expect(result.stats.integrationSteps).toBeLessThanOrEqual(256);
    expect(result.stats.states).toBeLessThanOrEqual(32);
    times.push(elapsed);
  }
  const cold = times[0];
  times.sort((a, b) => a - b);
  console.info(
    `cold navigator.decide=${coldDecideMs.toFixed(3)}ms; local planner, 100 runs without discarded warmups: first=${cold.toFixed(3)}ms p50=${times[50].toFixed(3)}ms p95=${times[95].toFixed(3)}ms max=${times[99].toFixed(3)}ms; no worker roundtrip measured`
  );
});

it("executes an entire sampled jump with one strategy call until the observed landing", () => {
  const s = fixture();
  s.coins = [
    {
      id: "high",
      dx: 240,
      dy: 150,
      value: 10,
      bounds: { dx: 230, dy: 140, width: 20, height: 20 },
    },
  ];
  const routes = planRoutes(s);
  const option = routes.options.find((o) => o.target.kind === "coin")!;
  const leg = routes.plans.get(option.id)![0];
  const nav = createNavigator();
  let calls = 0;
  nav.decide(s, () => {
    calls++;
    return option.id;
  });
  let lastDecision = 0;
  for (let i = 0; i < leg.samples.length - 1; i++) {
    const sample = leg.samples[i];
    if (sample.atMs - lastDecision < s.tuning.tickMs) continue;
    lastDecision = sample.atMs;
    s.tick++;
    s.navigation!.frame = i + 1;
    s.navigation!.observedAtMs = sample.atMs;
    s.timeElapsedMs = sample.atMs;
    s.navigation!.body = { ...sample.body };
    s.onGround = false;
    nav.decide(s, () => {
      calls++;
      return null;
    });
    expect(nav.getDiagnostics().phase).toBe("execute");
    expect(nav.getDiagnostics().targetId).toBe("high");
  }
  expect(calls).toBe(1);
  s.tick++;
  s.navigation!.frame++;
  s.navigation!.observedAtMs = leg.durationMs;
  s.navigation!.body = { ...leg.end.body };
  s.onGround = true;
  s.velocity = { vx: leg.end.vx, vy: 0 };
  nav.decide(s, (context) => {
    expect(context.previousTargetId).toBe("high");
    calls++;
    return null;
  });
  expect(calls).toBe(2);
});
