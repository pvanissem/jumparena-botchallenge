// Leere Strategie-Hülle: Ohne eigene Auswahl bleibt der Bot stehen.
// API und Anweisungen: docs/02-bot-api.md und client/src/bot/AGENTS.md.
// Zielstrategien: examples/navigation/ (Sprinter, Sammler, vorsichtiger Bot).

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
  // state.checkpoints: sichtbare Fahnen; active bestätigt den gesetzten Checkpoint.
  // state.respawnPoint: bekannter Wiedererscheinungspunkt, keine Zielroute.
  // Hier eigene Bedingungen ergänzen und ein Angebot (oder null zum Warten) wählen.
  // Einstieg: return options.sort((a, b) => score(b) - score(a))[0] ?? null;
  // Angebote sind Schätzungen: Gegner können sich während eines Manövers bewegen.
  return null;
}

// Bevorzugter Einstieg: Hier nur das Besucherziel bestimmen.
// Zum Beispiel: { target: { kind: "goal" }, caution: "careful" }
// Oder: { target: { kind: "coin", id: state.coins[0].id } }
// Die Navigation übernimmt Bewegungsaufträge und lokale Wiederholungen.
// Eigene Bewegungsregeln: { target: { kind: "goal" }, choose(moves) { ... } }
// choose gibt eine angebotene id oder null zurück. Beispiele: high-route.js,
// ground-route.js und hopper.js unter examples/navigation/.
function selectGoal(state) {
  return null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 2,
  // Pflicht: Botname und Besucher-Anzeigename erfragen; diese Werte sind nur Platzhalter.
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    if (!state.navigation) return [];
    const intent = selectGoal(state);
    if (intent) return tools.navigate(intent);
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
