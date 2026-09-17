export default {
  apiVersion: 1, frameworkVersion: 2,
  name: "Blitz", author: "Referenz",
  decide(state, tools) {
    return tools.navigate({ target: { kind: "goal" } });
  },
};
