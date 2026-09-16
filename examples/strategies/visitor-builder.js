// Besucherregeln: Ziel, Boingo, Tempo und Warteabstand lassen sich hier ändern.
const preferences = { useBoingo: true, sprint: true, collect: false, hazardDistance: 0 };
let command = null;
let attempted = new Set();
let epoch = null;

function nextCommand(state) {
  const body = state.navigation.body;
  const center = body.x + body.width / 2;
  const feet = body.y + body.height;
  const direction = Math.sign(state.goalDirection.dx) || 1;
  const surfaces = state.platforms.map((p) => ({ ...p,
    x: state.position.x + p.dx, y: state.position.y + p.dy,
  }));
  const support = surfaces.find((p) => Math.abs(p.y - feet) < 3 && center >= p.x && center <= p.x + p.width);
  const nearEdge = state.gapAhead.present && state.gapAhead.distance <= 60;
  const margin = body.width / 2 + 8;
  const platforms = surfaces.map((p) => ({ ...p,
    landingX: Math.max(p.x + margin, Math.min(center, p.x + p.width - margin)),
  })).filter((p) => p.id && p.width >= body.width + 16 &&
    (p.landingX - center) * direction > body.width &&
    Math.abs(p.landingX - center) < 420 && (Math.abs(p.y - feet) > 16 || nearEdge))
    .sort((a, b) => Math.abs(a.landingX - center) - Math.abs(b.landingX - center) || a.id.localeCompare(b.id));
  // Erst einen nahen Boingo für eine höhere Landung ausprobieren.
  if (preferences.useBoingo) {
    const spring = state.utilities.find((u) => u.id && u.kind === "boingo" && Math.abs(u.dx) < 260);
    const target = platforms.find((p) => p.y < feet - 60);
    if (spring && target) {
      const id = `boingo:${spring.id}:${target.id}`;
      if (!attempted.has(id)) return { id, kind: "boingo", utilityId: spring.id,
        platformId: target.id, x: target.landingX, sprint: preferences.sprint };
    }
  }
  // Die Bot-Datei entscheidet selbst, welche sichtbare Plattform sie versucht.
  for (const target of platforms) {
    const id = `jump:${target.id}`;
    if (!attempted.has(id)) return { id, kind: "jump", platformId: target.id, x: target.landingX,
      sprint: preferences.sprint };
  }
  if (preferences.collect && state.timeElapsedMs < 65000 && state.livesRemaining > 1) {
    const fruit = state.coins.find((c) => c.id && Math.abs(c.dx) < 180 && Math.abs(c.dy) < 40 && !attempted.has(`fruit:${c.id}`));
    if (fruit) return { id: `fruit:${fruit.id}`, kind: "walk", x: state.position.x + fruit.dx, sprint: false };
  }
  const goalId = `goal:${support?.id ?? "ground"}`;
  if (!attempted.has(goalId)) return { id: goalId, kind: "walk",
    x: state.position.x + state.goalDirection.dx, sprint: preferences.sprint };
  return null;
}

export default {
  apiVersion: 1, frameworkVersion: 2, name: "Messe-Werkstatt", author: "Gast",
  decide(state, tools) {
    if (!state.navigation) return [];
    if (epoch !== state.navigation.epoch || state.justRespawned) {
      epoch = state.navigation.epoch;
      command = null;
      attempted = new Set();
    }
    // Warten ist eine eigene Entscheidung; danach beginnt ein neuer Auftrag.
    const direction = Math.sign(state.goalDirection.dx) || 1;
    if (preferences.hazardDistance > 0 && state.onGround && state.hazards.some((h) =>
      h.active && h.dx * direction > 0 && h.dx * direction < preferences.hazardDistance && Math.abs(h.dy) < 50)) {
      command = null;
      return [];
    }
    const status = tools.status();
    if (command && status.state === "running") return tools.run(command);
    if (!state.onGround) return [];
    if (command) attempted.add(command.id);
    command = nextCommand(state);
    return command ? tools.run(command) : [];
  },
};
