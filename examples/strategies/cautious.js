// Risiko ist ein relativer Kostenwert, keine Sterbewahrscheinlichkeit.
function choose(context, options) {
  const routes = options.filter((option) => !option.route.mechanics.includes("stomp"));
  routes.sort((a, b) =>
    a.route.risk - b.route.risk ||
    b.route.landingMarginPx - a.route.landingMarginPx ||
    b.route.goalProgressPx - a.route.goalProgressPx ||
    a.id.localeCompare(b.id)
  );
  return routes[0]?.id ?? null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 1,
  name: "Vorsichtiger",
  author: "Arena",
  decide(state, tools) {
    return tools.navigate({ choose });
  },
};
