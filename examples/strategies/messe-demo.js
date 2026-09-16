// Level 1: Unsere editierbare Reiseroute. Ziele und Sprunghalten hier verändern.
const walk = (x, sprint = true) => ({ kind: "walk", x, sprint });
const jump = (platform, x, holdMs = 600) => ({ kind: "jump", platformId: `level-one:platform:${platform}`, x, sprint: true, holdMs });
const boingo = (utility, platform, x) => ({ kind: "boingo", utilityId: `boingo-${utility}`, platformId: `level-one:platform:${platform}`, x, sprint: true });
// Wiedereinstieg steht beim passenden Auftrag; zusätzliche Schritte verschieben ihn nicht.
const resume = (x, command) => ({ ...command, resumeAt: x });
const route = [
  resume(0, walk(200)), jump(8, 360), jump(1, 620), // F1, dann über den Stachlinger
  jump(2, 820), jump(9, 904), jump(2, 1008, 180), // kurzer Abstieg vom Bonus
  jump(3, 1204), walk(1280), resume(1470, jump(4, 1490)),
  boingo(1, 5, 2070), // hoch über beide Feuersäulen, Landung dahinter
  jump(6, 2260), resume(2240, walk(2500)), boingo(2, 12, 2632),
  jump(7, 2860), walk(3330), resume(3504, jump(13, 3600)),
  jump(13, 3780), walk(3800), resume(3952, jump(14, 4160)),
  resume(4368, jump(15, 4400)), walk(4660), jump(16, 4840),
  resume(4816, walk(5160)), jump(20, 5356), resume(5450, walk(5420)),
  { kind: "wait", hazardId: "loderix-3" },
  walk(5900, false), // bewusst normal laufen: Gegenphase des zweiten Feuers
  boingo(3, 21, 6288), boingo(4, 22, 6688), boingo(5, 23, 7100),
  jump(24, 7310), resume(7232, walk(7792)),
];
let epoch = null;
let step = 0;
let attempt = 0;
let command = null;
let retryAt = null;
let sawActive = false;

export default {
  apiVersion: 1, frameworkVersion: 2, name: "Messe-Reiseroute", author: "Gast",
  decide(state, tools) {
    if (!state.navigation) return [];
    if (epoch !== state.navigation.epoch || state.justRespawned) {
      epoch = state.navigation.epoch;
      step = route.reduce((last, entry, index) =>
        entry.resumeAt <= state.position.x + 8 ? index : last, 0);
      attempt = 0; command = null; retryAt = null; sawActive = false;
    }
    const status = tools.status();
    if (command && status.commandId === command.id) {
      if (status.state === "running") return tools.run(command);
      if (status.state === "succeeded") {
        step++; command = null; retryAt = null; sawActive = false;
      } else if (status.state === "failed") {
        retryAt ??= state.timeElapsedMs + 600;
        if (!state.onGround || state.timeElapsedMs < retryAt) return [];
        attempt++; command = null; retryAt = null;
      }
    }
    // Auch nach einem Schaden erst tatsächlich landen, dann neu starten.
    if (!state.onGround && !command) return [];
    if (retryAt !== null) {
      if (!state.onGround || state.timeElapsedMs < retryAt) return [];
      attempt++; command = null; retryAt = null;
    }
    if (route[step]?.kind === "wait") {
      const hazard = state.hazards.find((h) => h.id === route[step].hazardId);
      if (hazard?.active) sawActive = true;
      if (!hazard || hazard.active || !sawActive) return [];
      step++; sawActive = false;
    }
    if (!route[step]) return [];
    if (!command) {
      command = { ...route[step], id: `route:${step}:try:${attempt}` };
      delete command.resumeAt; // Routenmarkierung gehört nicht zum Bewegungsauftrag.
    }
    return tools.run(command);
  },
};
