let target = null;
let selectedAt = 0;
let skipped = new Set();
let epoch = null;
export default {
  apiVersion: 1, frameworkVersion: 2,
  name: "Goldgräber", author: "Referenz",
  decide(state, tools) {
    if (epoch !== state.navigation?.epoch || state.justRespawned) {
      epoch = state.navigation?.epoch; target = null; skipped = new Set();
    }
    // Ein Schatz ist ein eigenes Ziel, nicht nur ein Bonus für Vorwärtsbewegung.
    if (target && (!state.coins.some(c => c.id === target) ||
      state.timeElapsedMs - selectedAt > 8000 || tools.status().state === "failed")) {
      skipped.add(target); target = null;
    }
    if (!target && state.timeElapsedMs < 45000) {
      const candidates = state.coins.filter(c => c.id && !skipped.has(c.id));
      candidates.sort((a, b) => b.value / (80 + Math.hypot(b.dx, b.dy)) - a.value / (80 + Math.hypot(a.dx, a.dy)));
      target = candidates[0]?.id ?? null;
      selectedAt = state.timeElapsedMs;
    }
    return tools.navigate({ target: target && state.timeElapsedMs < 45000
      ? {kind: "coin", id: target} : {kind: "goal"} });
  },
};
