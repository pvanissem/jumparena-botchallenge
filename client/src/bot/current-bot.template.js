// Ziele und Prioritaeten gehoeren dir, die Bewegung uebernimmt das Framework.
function choose(context, options) {
  const goals = options.filter((option) => option.target.kind === "goal");
  goals.sort((a, b) => b.route.goalProgressPx - a.route.goalProgressPx || a.id.localeCompare(b.id));
  return goals[0]?.id ?? null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 1,
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    return tools.navigate({ choose });
  },
};
