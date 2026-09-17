function shortestJump(moves) {
  return [...moves].sort((a, b) =>
    a.durationMs - b.durationMs ||
    a.distance - b.distance ||
    b.progress - a.progress
  )[0];
}

export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Hüpfer",
  author: "Test",

  decide(state, tools) {
    return tools.navigate({
      target: { kind: "goal" },
      caution: "normal",

      choose(moves) {
        const forwardJumps = moves.filter(
          move => move.kind === "jump" && move.progress > 0
        );

        // Angebotene Sprünge über Gegner haben Vorrang.
        const enemyJumps = forwardJumps.filter(
          move => move.crossesEnemy
        );
        const overEnemy = shortestJump(enemyJumps);
        if (overEnemy) return overEnemy.id;

        // Kurze Manöver bevorzugen, ohne längere nötige Sprünge auszuschließen.
        const shortJump = shortestJump(forwardJumps);
        if (shortJump) return shortJump.id;

        // Ohne Vorwärtssprung weiterlaufen oder eine andere Bewegung nutzen.
        const forward = moves.find(move => move.progress > 0);
        return forward?.id ?? moves[0]?.id ?? null;
      },
    });
  },
};
