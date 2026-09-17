// Besucherwunsch: "Lauf möglichst am Boden und spring nur, wenn nötig."
export default {
  apiVersion: 1, frameworkVersion: 2,
  name: "Bodenläufer", author: "Referenz",
  decide(state, tools) {
    return tools.navigate({
      target: {kind: "goal"},
      choose(moves) {
        const walks = moves.filter(m => m.kind === "walk" && m.progress > 0);
        walks.sort((a, b) => b.progress - a.progress);
        return walks[0]?.id ?? moves[0]?.id ?? null;
      },
    });
  },
};
