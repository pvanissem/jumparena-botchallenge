// Sprinten, möglichst am Boden bleiben, Frogs gezielt stompen.
export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Stampfer",
  author: "Referenz",
  decide(state, tools) {
    return tools.navigate({
      target: { kind: "goal" },
      enemies: "stomp",
      movement: "ground",
      allowBoingo: "fallback",
    });
  },
};
