// Kein gezielter Sammelumweg: Fortschritt pro geschaetzter Zeit gewinnt.
function choose(context, options) {
  const goals = options.filter((option) => option.target.kind === "goal");
  goals.sort((a, b) =>
    b.route.goalProgressPx / Math.max(1, b.route.estimatedDurationMs) -
      a.route.goalProgressPx / Math.max(1, a.route.estimatedDurationMs) ||
    a.id.localeCompare(b.id)
  );
  return goals[0]?.id ?? null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 1,
  name: "Sprinter",
  author: "Arena",
  decide(state, tools) {
    return tools.navigate({ choose });
  },
};
