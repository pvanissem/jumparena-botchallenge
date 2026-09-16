function choose(context, options) {
  const goals = options.filter((option) => option.target.kind === "goal");
  goals.sort((a, b) =>
    b.route.goalProgressPx / Math.max(1, b.route.estimatedDurationMs) -
      a.route.goalProgressPx / Math.max(1, a.route.estimatedDurationMs) ||
    a.id.localeCompare(b.id)
  );
  const goal = goals[0];
  // Endspurt oder letztes Leben: keine weiteren Sammelumwege.
  if (context.timeElapsedMs >= 65000 || context.timeRemainingMs <= 25000 || context.livesRemaining <= 1) {
    return goal?.id ?? null;
  }
  const fruits = options.filter((option) =>
    option.target.kind === "coin" && option.route.scope === "target-reachable" &&
    option.route.detourPx <= 320 && option.route.expectedFruitValue > 0
  );
  // Zusatzzeit gegen die bevorzugte Zielroute; mindestens 1 ms als Nenner.
  const baselineMs = goal?.route.estimatedDurationMs ?? 0;
  fruits.sort((a, b) =>
    b.route.expectedFruitValue / Math.max(1, b.route.estimatedDurationMs - baselineMs) -
      a.route.expectedFruitValue / Math.max(1, a.route.estimatedDurationMs - baselineMs) ||
    a.id.localeCompare(b.id)
  );
  return fruits[0]?.id ?? goal?.id ?? null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 1,
  name: "Sammler",
  author: "Arena",
  decide(state, tools) {
    return tools.navigate({ choose });
  },
};
