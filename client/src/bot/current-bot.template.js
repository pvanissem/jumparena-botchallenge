// Leere Strategie-Hülle: Ohne eigene Auswahl bleibt der Bot stehen.
// API und Anweisungen: docs/02-bot-api.md und client/src/bot/AGENTS.md.
// Vollständiges Beispiel: examples/strategies/visitor-builder.js.

// Hier übersetzt der Agent Besucherwünsche in Gewichtung und eigene Regeln.
const weights = { progress: 1, fruit: 0.15, time: 0.15 };
let command = null;
let epoch = null;

function score(option) {
  return weights.progress * option.progress / 400
    + weights.fruit * option.fruitValue / 30
    - weights.time * option.durationMs / 1500;
}

function selectMovement(state, options) {
  // Angebote entstehen aus der Wahrnehmung, nicht aus einer festen Levelroute.
  // Hier eigene Bedingungen ergänzen und ein Angebot (oder null zum Warten) wählen.
  // Einstieg: return options.sort((a, b) => score(b) - score(a))[0] ?? null;
  // Angebote sind Schätzungen: Gegner können sich während eines Manövers bewegen.
  return null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    if (!state.navigation) return [];
    if (epoch !== state.navigation.epoch || state.justRespawned) {
      epoch = state.navigation.epoch;
      command = null;
      // Eigenes Gedächtnis für diese Runde ebenfalls hier zurücksetzen.
    }

    const status = tools.status();
    // Baseline: Auftrag bis zur Landung fortsetzen. Eigene Gefahrenreaktionen
    // dürfen ihn ersetzen; [] im Flug ist allein noch kein Ausweichmanöver.
    if (command && status.commandId === command.id && status.state === "running") {
      return tools.run(command);
    }
    // Bei Bedarf status.reason auswerten und Fehlversuche vorübergehend sperren.
    command = null;
    if (!state.onGround) return [];

    const selected = selectMovement(state, tools.options());
    command = selected?.command ?? null;
    // Eigene run-Aufträge oder rohe Actions bleiben möglich; nur eine Steuerquelle.
    return command ? tools.run(command) : [];
  },
};
