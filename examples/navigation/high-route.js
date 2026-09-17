// Besucherwunsch: "Nimm lieber die oberen Plattformen."
export default {
  apiVersion: 1, frameworkVersion: 2,
  name: "Dachläufer", author: "Referenz",
  decide(state, tools) {
    return tools.navigate({
      target: {kind: "goal"},
      choose(moves) {
        const upward = moves.filter(m => m.rise > 30 && m.progress > 0);
        upward.sort((a, b) => b.rise - a.rise || b.progress - a.progress);
        return upward[0]?.id ?? moves[0]?.id ?? null;
      },
    });
  },
};
