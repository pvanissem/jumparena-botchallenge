// Eigene Strategie: diese Gewichte und die Bewertung darf der Besucher verändern.
const weights = { progress: 1, fruit: 0.15, time: 0.15 };
let command = null;
let epoch = null;
let failed = new Map();
let fires = new Map();

function score(option) {
  return weights.progress * option.progress / 400
    + weights.fruit * option.fruitValue / 30
    - weights.time * option.durationMs / 1500
    - (option.command.kind === "walk" ? 0 : 0.12);
}
function key(c) {
  return `${c.kind}:${c.platformId ?? ""}:${Math.round(c.x / 20)}:${c.holdMs ?? 0}:${c.runUpMs ?? 0}`;
}
export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Umgebungsbot",
  author: "Gast",
  decide(state, tools) {
    if (!state.navigation) return [];
    if (epoch !== state.navigation.epoch || state.justRespawned) {
      epoch = state.navigation.epoch; command = null; failed = new Map(); fires = new Map();
    }
    for (const h of state.hazards) {
      if (h.kind !== "loderix" || !h.id) continue;
      const previous = fires.get(h.id);
      fires.set(h.id, { active: h.active, openedAt: h.active ? null
        : previous?.active ? state.timeElapsedMs : previous?.openedAt });
    }
    const status = tools.status();
    if (command && status.commandId === command.id) {
      if (status.state === "running") return tools.run(command);
      if (status.state === "failed") failed.set(key(command), state.timeElapsedMs + 1500);
    }
    command = null;
    if (!state.onGround) return [];
    const choices = tools.options().filter(o => {
      if ((failed.get(key(o.command)) ?? 0) > state.timeElapsedMs) return false;
      const center = state.navigation.body.x + state.navigation.body.width / 2;
      const half = state.navigation.body.width / 2;
      for (const h of state.hazards) {
        if (h.kind !== "loderix" || !h.bounds || Math.abs(h.dy) > 45) continue;
        // Vor getaktetem Feuer warten statt auf einen Rückweg auszuweichen.
        if (h.dx > 0 && h.dx < 80 && o.progress < 0) return false;
        if (o.command.kind !== "walk") continue;
        const left = state.position.x + h.bounds.dx, right = left + h.bounds.width;
        if (Math.max(center, o.command.x) + half <= left ||
            Math.min(center, o.command.x) - half >= right) continue;
        const openedAt = fires.get(h.id)?.openedAt;
        if (h.active || openedAt == null || state.timeElapsedMs - openedAt > 250) return false;
      }
      return true;
    });
    choices.sort((a, b) => score(b) - score(a));
    command = choices[0]?.command ?? null;
    return command ? tools.run(command) : [];
  },
};
